import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { advanceRecurringImportantDate } from "@/lib/important-dates/server";
import {
  buildReminderEmail,
  type DueReminderRow,
} from "@/lib/reminders/buildReminderEmail";
import { sendReminderEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;
const BATCH_LIMIT = 50;
// Longer than this cron is ever expected to take for one batch — a claim
// older than this is assumed abandoned (the invocation that took it crashed
// or timed out) rather than still in progress, and can be re-claimed.
const CLAIM_STALE_MS = 10 * 60 * 1000;

const DUE_REMINDER_SELECT = `
  id, reminder_type, channel, scheduled_at, days_before, retry_count, user_id,
  important_date_id, invite_id, occasion_id, advance_expected_date,
  important_dates ( person_name, occasion_type, date, linked_wishlist_id, is_recurring ),
  occasions ( title, occasion_type, occasion_date ),
  wishlist_invites ( wishlist_id, token, wishlists ( title, occasions ( title, occasion_type, occasion_date ) ) )
`;

const PENDING_ADVANCE_SELECT = `
  id, user_id, important_date_id, advance_expected_date,
  important_dates ( date, is_recurring )
`;

interface AdvanceCandidate {
  id: string;
  user_id: string;
  important_date_id: string | null;
  advance_expected_date: string | null;
  important_dates:
    | { date: string; is_recurring: boolean }
    | { date: string; is_recurring: boolean }[]
    | null;
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] || null : value;
}

function staleThresholdIso() {
  return new Date(Date.now() - CLAIM_STALE_MS).toISOString();
}

async function getRecipientEmail(
  supabase: SupabaseClient,
  cache: Map<string, string | null>,
  userId: string,
) {
  if (cache.has(userId)) {
    return cache.get(userId) as string | null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const email = !error ? data?.user?.email || null : null;
  cache.set(userId, email);
  return email;
}

// Atomically claims a single due reminder before it's processed, so two
// overlapping cron invocations (a slow run plus the next scheduled trigger,
// or a manual re-trigger) can't both send the same reminder. The WHERE
// clause only matches rows that are still unclaimed or whose claim has gone
// stale — Postgres re-evaluates that condition against committed data when
// a concurrent UPDATE is waiting on the same row's lock, so only one caller
// ever sees a row actually get claimed (0 rows returned means "someone else
// has it" or its state already changed) without needing SELECT ... FOR
// UPDATE SKIP LOCKED via a separate RPC.
async function claimReminder(
  supabase: SupabaseClient,
  reminderId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("reminders")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("sent", false)
    .eq("permanently_failed", false)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .select("id");

  if (error) {
    console.error("Couldn't claim reminder for processing.", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

async function releaseClaim(supabase: SupabaseClient, reminderId: string) {
  const { error } = await supabase
    .from("reminders")
    .update({ claimed_at: null })
    .eq("id", reminderId);

  if (error) {
    console.error("Couldn't release reminder claim.", error);
  }
}

function needsRecurringAdvance(reminder: DueReminderRow): boolean {
  if (
    reminder.reminder_type !== "occasion_owner" ||
    !reminder.important_date_id ||
    reminder.days_before !== 3
  ) {
    return false;
  }

  return Boolean(first(reminder.important_dates)?.is_recurring);
}

// Advancing the important date (and rescheduling next year's reminders) is a
// separate Supabase call from the one that marks this reminder sent, so it
// can fail independently. On failure we deliberately leave `advance_pending`
// true and only log — the caller already persisted that flag alongside
// `sent=true` before this runs, and retryPendingAdvancements() picks rows
// like this back up on a later cron run without re-sending the email.
async function tryAdvance(
  supabase: SupabaseClient,
  candidate: AdvanceCandidate,
) {
  const importantDate = first(candidate.important_dates);

  if (!candidate.important_date_id || !importantDate) {
    return;
  }

  try {
    const result = await advanceRecurringImportantDate({
      supabase,
      userId: candidate.user_id,
      importantDateId: candidate.important_date_id,
      date: importantDate.date,
      expectedDate: candidate.advance_expected_date || undefined,
    });

    if (result === "advanced" || result === "already-advanced") {
      const { error } = await supabase
        .from("reminders")
        .update({ advance_pending: false, advance_expected_date: null })
        .eq("id", candidate.id);

      if (error) {
        console.error(
          "Advance succeeded but clearing advance_pending failed; will retry next run.",
          error,
        );
      }
    }
  } catch (error) {
    console.error(
      "Recurring important date advancement failed; will retry next run.",
      error,
    );
  }
}

async function retryPendingAdvancements(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("reminders")
    .select(PENDING_ADVANCE_SELECT)
    .eq("advance_pending", true)
    .not("important_date_id", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error || !data) {
    return;
  }

  for (const candidate of data as unknown as AdvanceCandidate[]) {
    await tryAdvance(supabase, candidate);
  }
}

async function processDueReminder(
  supabase: SupabaseClient,
  reminder: DueReminderRow,
  emailCache: Map<string, string | null>,
): Promise<"processed" | "failed" | "skipped"> {
  const recipientEmail = await getRecipientEmail(
    supabase,
    emailCache,
    reminder.user_id,
  );

  if (!recipientEmail) {
    await incrementFailure(supabase, reminder);
    return "failed";
  }

  const email = buildReminderEmail({ reminder, recipientEmail });

  if (!email) {
    // The parent important date/occasion/invite is gone (e.g. deleted while
    // queued) — nothing to send, and retrying will never succeed. Clean up
    // the orphaned row rather than treating this as a delivery failure.
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", reminder.id);

    if (error) {
      console.error("Couldn't delete orphaned reminder.", error);
    }

    return "skipped";
  }

  // Reused across retries (retry_count increments, but the reminder's id
  // never changes) so a request that reached Resend but whose response was
  // lost doesn't cause a real duplicate email on the next attempt.
  const result = await sendReminderEmail({
    ...email,
    idempotencyKey: reminder.id,
  });

  if (!result.sent) {
    await incrementFailure(supabase, reminder);
    return "failed";
  }

  const advancePending = needsRecurringAdvance(reminder);
  const importantDate = first(reminder.important_dates);
  const expectedAdvanceDate =
    advancePending && importantDate ? importantDate.date : null;

  // `advance_pending` is set in the same update as `sent=true` so the
  // pending-advancement state survives even if the process crashes or the
  // advance call below fails — it's never lost, only ever retried.
  const { error: sentUpdateError } = await supabase
    .from("reminders")
    .update({
      sent: true,
      sent_at: new Date().toISOString(),
      advance_pending: advancePending,
      advance_expected_date: expectedAdvanceDate,
    })
    .eq("id", reminder.id);

  if (sentUpdateError) {
    // The email genuinely sent — we must not increment retry_count (this
    // isn't a delivery failure) and must not treat it as unrecoverable.
    // Leaving `sent=false` means the row stays due and gets retried, which
    // is safe specifically because of the idempotency key above: Resend
    // will dedupe the retried request instead of sending a second email.
    // Releasing the claim lets that retry happen without waiting out the
    // stale-claim window.
    console.error(
      "Reminder email sent but marking it sent failed; will retry (deduped by idempotency key).",
      sentUpdateError,
    );
    await releaseClaim(supabase, reminder.id);
    return "processed";
  }

  if (advancePending) {
    await tryAdvance(supabase, reminder);
  }

  return "processed";
}

async function incrementFailure(
  supabase: SupabaseClient,
  reminder: DueReminderRow,
) {
  const newRetryCount = (reminder.retry_count || 0) + 1;

  const { error } = await supabase
    .from("reminders")
    .update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= MAX_RETRIES,
      claimed_at: null,
    })
    .eq("id", reminder.id);

  if (error) {
    console.error("Couldn't record reminder failure.", error);
  }
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonError("Cron secret is not configured.", 500);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const intentCutoff = new Date();
  intentCutoff.setHours(intentCutoff.getHours() - 24);

  const { count: deferredCount, error: deferredError } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("sent", false)
    .eq("permanently_failed", false)
    .eq("channel", "push")
    .lte("scheduled_at", now);

  if (deferredError) {
    console.error("Couldn't count deferred push reminders.", deferredError);
  }

  await retryPendingAdvancements(supabase);

  const { data: dueReminders, error: reminderError } = await supabase
    .from("reminders")
    .select(DUE_REMINDER_SELECT)
    .eq("sent", false)
    .eq("permanently_failed", false)
    .eq("channel", "email")
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (reminderError) {
    return jsonError("Couldn't process reminders.", 500);
  }

  const emailCache = new Map<string, string | null>();
  let processed = 0;
  let failed = 0;

  for (const reminder of (dueReminders || []) as unknown as DueReminderRow[]) {
    const claimed = await claimReminder(supabase, reminder.id);

    if (!claimed) {
      // Another invocation is already handling this one (or its state
      // changed since the select above) — not a failure, just skip it.
      continue;
    }

    try {
      const outcome = await processDueReminder(supabase, reminder, emailCache);

      if (outcome === "processed") {
        processed += 1;
      } else if (outcome === "failed") {
        failed += 1;
      }
    } catch (error) {
      console.error("Reminder processing failed.", error);
      await incrementFailure(supabase, reminder);
      failed += 1;
    }
  }

  return NextResponse.json({
    processed,
    failed,
    deferred: deferredCount || 0,
  });
}
