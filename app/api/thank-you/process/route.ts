import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { buildAutoThankYouEmail } from "@/lib/thank-you/buildThankYouEmail";
import { sendThankYouEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;
const BATCH_LIMIT = 50;
// Same staleness window as /api/reminders — long enough that this cron is
// never expected to still be running, so an older claim is assumed abandoned
// (crashed or timed out) rather than genuinely in progress.
const CLAIM_STALE_MS = 10 * 60 * 1000;

const DUE_THANK_YOU_SELECT = `
  id, message, purchase_id, order_id, receiver_id, buyer_id, retry_count,
  purchases ( wishlist_items ( title ) ),
  orders ( order_items ( product_title ) )
`;

interface DueThankYouRow {
  id: string;
  message: string;
  purchase_id: string | null;
  order_id: string | null;
  receiver_id: string;
  buyer_id: string;
  retry_count: number;
  purchases: { wishlist_items: { title: string } | { title: string }[] | null } | { wishlist_items: { title: string } | { title: string }[] | null }[] | null;
  orders: { order_items: { product_title: string }[] | null } | { order_items: { product_title: string }[] | null }[] | null;
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] || null : value;
}

function resolveItemTitle(row: DueThankYouRow): string {
  if (row.purchase_id) {
    const purchase = first(row.purchases);
    const wishlistItem = purchase ? first(purchase.wishlist_items) : null;
    return wishlistItem?.title || "your gift";
  }

  const order = first(row.orders);
  const firstOrderItem = order ? (order.order_items || [])[0] : null;
  return firstOrderItem?.product_title || "your gift";
}

function staleThresholdIso() {
  return new Date(Date.now() - CLAIM_STALE_MS).toISOString();
}

async function getUserEmail(
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

// Same atomic-claim pattern as /api/reminders — guards against two
// overlapping cron invocations both sending the same auto thank-you.
async function claimThankYou(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("thank_you_messages")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sent", false)
    .eq("permanently_failed", false)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .select("id");

  if (error) {
    console.error("Couldn't claim thank-you message for processing.", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

async function incrementFailure(supabase: SupabaseClient, row: DueThankYouRow) {
  const newRetryCount = (row.retry_count || 0) + 1;

  const { error } = await supabase
    .from("thank_you_messages")
    .update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= MAX_RETRIES,
      claimed_at: null,
    })
    .eq("id", row.id);

  if (error) {
    console.error("Couldn't record thank-you send failure.", error);
  }
}

async function processDueThankYou(
  supabase: SupabaseClient,
  row: DueThankYouRow,
  nameCache: Map<string, string | null>,
  emailCache: Map<string, string | null>
): Promise<"processed" | "failed"> {
  if (!nameCache.has(row.receiver_id)) {
    const { data, error } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", row.receiver_id)
      .maybeSingle();

    nameCache.set(row.receiver_id, !error ? data?.full_name || null : null);
  }

  const receiverName = nameCache.get(row.receiver_id) || "Someone";
  const buyerEmail = await getUserEmail(supabase, emailCache, row.buyer_id);

  if (!buyerEmail) {
    // Buyer has no email — shouldn't happen, but nothing more can be done.
    await supabase
      .from("thank_you_messages")
      .update({ permanently_failed: true, claimed_at: null })
      .eq("id", row.id);
    return "failed";
  }

  const email = buildAutoThankYouEmail({
    message: row.message,
    receiverName,
    itemTitle: resolveItemTitle(row),
  });

  // Reused across retries so a request that reached Resend but whose
  // response was lost doesn't cause a real duplicate email on retry.
  const result = await sendThankYouEmail({ to: buyerEmail, ...email, idempotencyKey: row.id });

  if (!result.sent) {
    await incrementFailure(supabase, row);
    return "failed";
  }

  const { error: sentUpdateError } = await supabase
    .from("thank_you_messages")
    .update({ sent: true, sent_at: new Date().toISOString() })
    .eq("id", row.id);

  if (sentUpdateError) {
    // The email genuinely sent — leave sent=false so it's retried, safe
    // because of the idempotency key (Resend dedupes the retried request).
    console.error(
      "Thank-you email sent but marking it sent failed; will retry (deduped by idempotency key).",
      sentUpdateError
    );
    await supabase.from("thank_you_messages").update({ claimed_at: null }).eq("id", row.id);
  }

  return "processed";
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

  const { data: pending, error: pendingError } = await supabase
    .from("thank_you_messages")
    .select(DUE_THANK_YOU_SELECT)
    .eq("type", "auto")
    .eq("sent", false)
    .eq("permanently_failed", false)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .lte("created_at", now)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (pendingError) {
    return jsonError("Couldn't process thank-you messages.", 500);
  }

  const nameCache = new Map<string, string | null>();
  const emailCache = new Map<string, string | null>();
  let processed = 0;
  let failed = 0;

  for (const row of (pending || []) as unknown as DueThankYouRow[]) {
    const claimed = await claimThankYou(supabase, row.id);

    if (!claimed) {
      continue;
    }

    try {
      const outcome = await processDueThankYou(supabase, row, nameCache, emailCache);

      if (outcome === "processed") {
        processed += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error("Thank-you processing failed.", error);
      await incrementFailure(supabase, row);
      failed += 1;
    }
  }

  return NextResponse.json({ processed, failed });
}
