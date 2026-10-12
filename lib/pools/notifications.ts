import { getAppUrl } from "@/lib/env";
import {
  sendPoolCashedOutEmail,
  sendPoolContributionReceiptEmail,
  sendPoolFullyFundedEmail,
} from "@/lib/email/pools";
import { createServiceClient } from "@/lib/supabase/server";
import type { GiftPool } from "@/lib/pools/types";

const CASHOUT_EMAIL_BATCH_LIMIT = 50;
const CASHOUT_EMAIL_IMMEDIATE_LIMIT = 10;
const CASHOUT_EMAIL_CONCURRENCY = 5;
const CLAIM_STALE_MS = 10 * 60 * 1000;

interface CashoutNotificationRow {
  id: string;
  pool_id: string;
  contribution_id: string;
  contributor_id: string;
  retry_count: number;
}

function asPool(value: unknown): GiftPool | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.token !== "string") return null;
  return {
    id: row.id,
    wishlist_id: String(row.wishlist_id ?? ""),
    wishlist_item_id: typeof row.wishlist_item_id === "string" ? row.wishlist_item_id : null,
    created_by: String(row.created_by ?? ""),
    receiver_id: String(row.receiver_id ?? ""),
    title: String(row.title ?? ""),
    message: typeof row.message === "string" ? row.message : null,
    target_amount: Number(row.target_amount ?? 0),
    amount_raised: Number(row.amount_raised ?? 0),
    min_contribution: Number(row.min_contribution ?? 1500),
    token: row.token,
    status: row.status as GiftPool["status"],
    contributors_visible: row.contributors_visible !== false,
    fully_funded_at: typeof row.fully_funded_at === "string" ? row.fully_funded_at : null,
    cashed_out_at: typeof row.cashed_out_at === "string" ? row.cashed_out_at : null,
    cashed_out_amount: row.cashed_out_amount == null ? null : Number(row.cashed_out_amount),
    created_at: String(row.created_at ?? ""),
  };
}

async function requireEmailDelivery(send: Promise<{ sent: boolean }>) {
  const result = await send;
  if (!result.sent) throw new Error("Pool notification email was not sent.");
}

async function getPool(poolId: string) {
  const service = createServiceClient();
  const { data, error } = await service.from("group_gift_pools").select("*").eq("id", poolId).maybeSingle();
  if (error) throw error;
  const pool = asPool(data);
  if (!pool) return null;
  return { service, pool, url: `${getAppUrl()}/pool/${pool.token}` };
}

async function getContact(userId: string) {
  const service = createServiceClient();
  const { data, error } = await service.from("users").select("email, full_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return {
    email: typeof data?.email === "string" ? data.email : null,
    full_name: typeof data?.full_name === "string" ? data.full_name : null,
  };
}

async function getContributorCount(poolId: string) {
  const service = createServiceClient();
  const { data, error } = await service.from("group_gift_pool_progress")
    .select("contributor_count").eq("pool_id", poolId).maybeSingle();
  if (error) throw error;
  return Number(data?.contributor_count ?? 0);
}

export async function sendContributionReceipt(contributionId: string, poolId: string, refundRequired: boolean) {
  const context = await getPool(poolId);
  if (!context) return;
  const { data: contribution, error } = await context.service.from("pool_contributions")
    .select("id, amount, contributor_id")
    .eq("id", contributionId)
    .maybeSingle();
  if (error || !contribution) {
    if (error) console.error("Could not load group pool contribution for receipt.", error);
    return;
  }

  const [contact, contributorCount] = await Promise.all([
    getContact(contribution.contributor_id),
    getContributorCount(poolId),
  ]);
  if (!contact.email) return;

  await requireEmailDelivery(sendPoolContributionReceiptEmail({
    to: contact.email,
    poolTitle: context.pool.title,
    amount: Number(contribution.amount),
    amountRaised: context.pool.amount_raised,
    targetAmount: context.pool.target_amount,
    contributorCount,
    poolUrl: context.url,
    contributionId,
    refundRequired,
  }));
}

export async function sendPoolFullyFunded(poolId: string) {
  const context = await getPool(poolId);
  if (!context) return;
  const [contact, contributorCount] = await Promise.all([
    getContact(context.pool.receiver_id),
    getContributorCount(poolId),
  ]);
  if (!contact.email) return;
  await requireEmailDelivery(sendPoolFullyFundedEmail({
    to: contact.email,
    poolTitle: context.pool.title,
    targetAmount: context.pool.target_amount,
    contributorCount,
    poolUrl: context.url,
    isItemPool: Boolean(context.pool.wishlist_item_id),
    poolId,
  }));
}

export async function sendPoolCashedOut(poolId: string) {
  await processCashoutNotifications({ poolId, limit: CASHOUT_EMAIL_IMMEDIATE_LIMIT });
}

export async function processPendingPoolCashoutNotifications() {
  return processCashoutNotifications({ limit: CASHOUT_EMAIL_BATCH_LIMIT });
}

async function deliverCashoutNotification(row: CashoutNotificationRow) {
  const context = await getPool(row.pool_id);
  if (!context || context.pool.status !== "paid_out") {
    throw new Error("Paid-out pool is unavailable for notification delivery.");
  }

  const [contact, contributorCount] = await Promise.all([
    getContact(row.contributor_id),
    getContributorCount(row.pool_id),
  ]);
  if (!contact.email) throw new Error("Contributor email address is unavailable.");

  await requireEmailDelivery(sendPoolCashedOutEmail({
    to: contact.email,
    poolTitle: context.pool.title,
    cashedOutAmount: context.pool.cashed_out_amount ?? context.pool.amount_raised,
    contributorCount,
    poolUrl: context.url,
    contributionId: row.contribution_id,
  }));
}

function nextCashoutEmailAttempt(retryCount: number) {
  const delayMs = Math.min(60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(retryCount, 6)));
  return new Date(Date.now() + delayMs).toISOString();
}

async function processCashoutNotification(
  service: ReturnType<typeof createServiceClient>,
  row: CashoutNotificationRow,
): Promise<"sent" | "failed" | "skipped"> {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  const { data: claim, error: claimError } = await service
    .from("group_gift_pool_cashout_notifications")
    .update({ claimed_at: nowIso })
    .eq("id", row.id)
    .is("sent_at", null)
    .lte("next_attempt_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("Could not claim pool cash-out notification.", claimError);
    return "failed";
  }
  if (!claim) return "skipped";

  try {
    await deliverCashoutNotification(row);
  } catch (error) {
    const retryCount = row.retry_count + 1;
    const { error: retryError } = await service
      .from("group_gift_pool_cashout_notifications")
      .update({
        retry_count: retryCount,
        next_attempt_at: nextCashoutEmailAttempt(row.retry_count),
        last_error: error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed.",
        claimed_at: null,
      })
      .eq("id", row.id)
      .is("sent_at", null);
    if (retryError) {
      console.error("Could not schedule pool cash-out notification retry.", retryError);
    }
    console.error("Pool cash-out email delivery failed; notification remains queued.", {
      notificationId: row.id,
      error,
    });
    return "failed";
  }

  const { error: sentError } = await service
    .from("group_gift_pool_cashout_notifications")
    .update({ sent_at: new Date().toISOString(), claimed_at: null, last_error: null })
    .eq("id", row.id)
    .is("sent_at", null);

  if (sentError) {
    // The email may have reached Resend. Releasing the claim lets a retry
    // recover the row; sendPoolCashedOutEmail uses the stable contribution
    // idempotency key to avoid sending a duplicate.
    const { error: releaseError } = await service
      .from("group_gift_pool_cashout_notifications")
      .update({ claimed_at: null, next_attempt_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("sent_at", null);
    console.error("Pool cash-out email sent but queue update failed.", sentError);
    if (releaseError) console.error("Could not release sent pool email claim.", releaseError);
    return "failed";
  }

  return "sent";
}

async function processCashoutNotifications({
  poolId,
  limit,
}: {
  poolId?: string;
  limit: number;
}) {
  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  let query = service
    .from("group_gift_pool_cashout_notifications")
    .select("id, pool_id, contribution_id, contributor_id, retry_count")
    .is("sent_at", null)
    .lte("next_attempt_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (poolId) query = query.eq("pool_id", poolId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as CashoutNotificationRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (let offset = 0; offset < rows.length; offset += CASHOUT_EMAIL_CONCURRENCY) {
    const results = await Promise.all(rows.slice(offset, offset + CASHOUT_EMAIL_CONCURRENCY)
      .map((row) => processCashoutNotification(service, row)));
    for (const result of results) {
      if (result === "sent") sent += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }

  return { sent, failed, skipped };
}
