import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getAppUrl } from "@/lib/env";
import { buildOrderStatusEmail } from "@/lib/orders/buildOrderStatusEmail";
import { CUSTOMER_FACING_STATUSES, type OrderStatus } from "@/lib/orders/types";
import { sendOrderStatusEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;
// Unlike /api/thank-you/process (which declares `maxDuration = 300` and
// fans out across MAX_CONCURRENCY workers), this route has no maxDuration
// override and processes rows one at a time — so it inherits the platform's
// default execution limit (10s on Vercel's Hobby plan, no Fluid Compute).
// Each row does a claim + optional auth.admin.getUserById + a Resend call
// (up to its own 8s abort timeout) + a notified-update, all sequentially,
// so a batch of 50 could easily blow past that window. A small batch that
// only fits the common (fast) case is fine — a row that doesn't finish in
// time is simply retried on the next run once its claim goes stale.
const BATCH_LIMIT = 10;
// Same staleness window as /api/reminders and /api/thank-you/process — a
// claim older than this is assumed abandoned rather than still in progress.
const CLAIM_STALE_MS = 10 * 60 * 1000;

const PENDING_HISTORY_SELECT = `
  id, order_id, status, retry_count, notes,
  orders ( buyer_id, tracking_number, tracking_url, carrier_name )
`;

interface OrderJoin {
  buyer_id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_name: string | null;
}

interface PendingHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  retry_count: number;
  notes: string | null;
  orders: OrderJoin | OrderJoin[] | null;
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function staleThresholdIso() {
  return new Date(Date.now() - CLAIM_STALE_MS).toISOString();
}

// Same atomic-claim pattern as /api/reminders and /api/thank-you/process —
// guards against two overlapping cron invocations sending the same email.
async function claimHistoryRow(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("order_status_history")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_notified", false)
    .eq("permanently_failed", false)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .select("id");

  if (error) {
    console.error("Couldn't claim order status history row for notify.", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

async function incrementFailure(supabase: SupabaseClient, row: PendingHistoryRow) {
  const newRetryCount = (row.retry_count || 0) + 1;

  const { error } = await supabase
    .from("order_status_history")
    .update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= MAX_RETRIES,
      claimed_at: null,
    })
    .eq("id", row.id);

  if (error) {
    console.error("Couldn't record order notification failure.", error);
  }
}

async function processRow(
  supabase: SupabaseClient,
  row: PendingHistoryRow,
  emailCache: Map<string, string | null>,
): Promise<"processed" | "failed"> {
  const order = first(row.orders);

  if (!order) {
    // Order was hard-deleted out from under a queued history row — nothing
    // left to notify about, and it can never succeed on retry.
    await supabase
      .from("order_status_history")
      .update({ permanently_failed: true, claimed_at: null })
      .eq("id", row.id);
    return "failed";
  }

  if (!emailCache.has(order.buyer_id)) {
    const { data, error } = await supabase.auth.admin.getUserById(order.buyer_id);
    emailCache.set(order.buyer_id, !error ? data?.user?.email || null : null);
  }

  const buyerEmail = emailCache.get(order.buyer_id) || null;

  if (!buyerEmail) {
    await incrementFailure(supabase, row);
    return "failed";
  }

  const email = buildOrderStatusEmail({
    status: row.status,
    orderId: row.order_id,
    orderUrl: `${getAppUrl()}/account/orders/${row.order_id}`,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    carrierName: order.carrier_name,
    cancelReason: row.status === "cancelled" ? row.notes : null,
  });

  // Reused across retries so a request that reached Resend but whose
  // response was lost doesn't cause a real duplicate email on retry.
  const result = await sendOrderStatusEmail({
    to: buyerEmail,
    ...email,
    idempotencyKey: row.id,
  });

  if (!result.sent) {
    await incrementFailure(supabase, row);
    return "failed";
  }

  const { error: notifiedUpdateError } = await supabase
    .from("order_status_history")
    .update({ customer_notified: true })
    .eq("id", row.id);

  if (notifiedUpdateError) {
    // The email genuinely sent — leave customer_notified=false so it's
    // retried, safe because of the idempotency key (Resend dedupes it).
    console.error(
      "Order status email sent but marking it notified failed; will retry (deduped by idempotency key).",
      notifiedUpdateError,
    );
    await supabase
      .from("order_status_history")
      .update({ claimed_at: null })
      .eq("id", row.id);
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

  const { data: pending, error: pendingError } = await supabase
    .from("order_status_history")
    .select(PENDING_HISTORY_SELECT)
    .eq("customer_notified", false)
    .eq("permanently_failed", false)
    .in("status", CUSTOMER_FACING_STATUSES)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThresholdIso()}`)
    .order("changed_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (pendingError) {
    return jsonError("Couldn't process order notifications.", 500);
  }

  const rows = (pending || []) as unknown as PendingHistoryRow[];
  const emailCache = new Map<string, string | null>();
  let notified = 0;
  let failed = 0;

  for (const row of rows) {
    const claimed = await claimHistoryRow(supabase, row.id);

    if (!claimed) {
      continue;
    }

    try {
      const outcome = await processRow(supabase, row, emailCache);

      if (outcome === "processed") {
        notified += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error("Order notification processing failed.", error);
      await incrementFailure(supabase, row);
      failed += 1;
    }
  }

  return NextResponse.json({ notified, failed });
}
