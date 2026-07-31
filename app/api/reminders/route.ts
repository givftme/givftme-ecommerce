import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { advanceRecurringImportantDate } from "@/lib/important-dates/server";
import { buildReminderEmail, type DueReminderRow } from "@/lib/reminders/buildReminderEmail";
import { sendReminderEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;
const BATCH_LIMIT = 50;

const DUE_REMINDER_SELECT = `
  id, reminder_type, channel, scheduled_at, days_before, retry_count, user_id,
  important_date_id, invite_id, occasion_id,
  important_dates ( person_name, occasion_type, date, linked_wishlist_id, is_recurring ),
  occasions ( title, occasion_type, occasion_date ),
  wishlist_invites ( wishlist_id, token, wishlists ( title, occasions ( title, occasion_type, occasion_date ) ) )
`;

async function getRecipientEmail(
  supabase: SupabaseClient,
  cache: Map<string, string | null>,
  userId: string
) {
  if (cache.has(userId)) {
    return cache.get(userId) as string | null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const email = !error ? data?.user?.email || null : null;
  cache.set(userId, email);
  return email;
}

async function handleRecurringAdvance(supabase: SupabaseClient, reminder: DueReminderRow) {
  if (
    reminder.reminder_type !== "occasion_owner" ||
    !reminder.important_date_id ||
    reminder.days_before !== 3
  ) {
    return;
  }

  const importantDate = Array.isArray(reminder.important_dates)
    ? reminder.important_dates[0]
    : reminder.important_dates;

  if (!importantDate || !importantDate.is_recurring) {
    return;
  }

  try {
    await advanceRecurringImportantDate({
      supabase,
      userId: reminder.user_id,
      importantDateId: reminder.important_date_id,
      date: importantDate.date,
    });
  } catch (error) {
    console.error("Recurring important date advancement failed.", error);
  }
}

async function processDueReminder(
  supabase: SupabaseClient,
  reminder: DueReminderRow,
  emailCache: Map<string, string | null>
): Promise<"processed" | "failed" | "skipped"> {
  const recipientEmail = await getRecipientEmail(supabase, emailCache, reminder.user_id);

  if (!recipientEmail) {
    await incrementFailure(supabase, reminder);
    return "failed";
  }

  const email = buildReminderEmail({ reminder, recipientEmail });

  if (!email) {
    // The parent important date/occasion/invite is gone (e.g. deleted while
    // queued) — nothing to send, and retrying will never succeed. Clean up
    // the orphaned row rather than treating this as a delivery failure.
    await supabase.from("reminders").delete().eq("id", reminder.id);
    return "skipped";
  }

  const result = await sendReminderEmail(email);

  if (!result.sent) {
    await incrementFailure(supabase, reminder);
    return "failed";
  }

  await supabase
    .from("reminders")
    .update({ sent: true, sent_at: new Date().toISOString() })
    .eq("id", reminder.id);

  await handleRecurringAdvance(supabase, reminder);

  return "processed";
}

async function incrementFailure(supabase: SupabaseClient, reminder: DueReminderRow) {
  const newRetryCount = (reminder.retry_count || 0) + 1;

  await supabase
    .from("reminders")
    .update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= MAX_RETRIES,
    })
    .eq("id", reminder.id);
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

  const { error: intentError } = await supabase
    .from("wishlist_items")
    .update({ intent_flagged_by: null, intent_flagged_at: null })
    .eq("status", "available")
    .lt("intent_flagged_at", intentCutoff.toISOString())
    .not("intent_flagged_at", "is", null);

  if (intentError) {
    return jsonError("Couldn't expire intent flags.", 500);
  }

  const { data: dueReminders, error: reminderError } = await supabase
    .from("reminders")
    .select(DUE_REMINDER_SELECT)
    .eq("sent", false)
    .eq("permanently_failed", false)
    .eq("channel", "email")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (reminderError) {
    return jsonError("Couldn't process reminders.", 500);
  }

  const { count: deferredCount } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("sent", false)
    .eq("permanently_failed", false)
    .eq("channel", "push")
    .lte("scheduled_at", now);

  const emailCache = new Map<string, string | null>();
  let processed = 0;
  let failed = 0;

  for (const reminder of (dueReminders || []) as unknown as DueReminderRow[]) {
    try {
      const outcome = await processDueReminder(supabase, reminder, emailCache);

      if (outcome === "processed") {
        processed += 1;
      } else if (outcome === "failed") {
        failed += 1;
      }
    } catch (error) {
      console.error("Reminder processing failed.", error);
      failed += 1;
    }
  }

  return NextResponse.json({
    processed,
    failed,
    deferred: deferredCount || 0,
  });
}
