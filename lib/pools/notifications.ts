import { getAppUrl } from "@/lib/env";
import {
  sendPoolCashedOutEmail,
  sendPoolContributionReceiptEmail,
  sendPoolFullyFundedEmail,
} from "@/lib/email/pools";
import { createServiceClient } from "@/lib/supabase/server";
import type { GiftPool } from "@/lib/pools/types";

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

async function getAppliedContributions(poolId: string) {
  const service = createServiceClient();
  const rows: Array<{ id: string; amount: number; contributor_id: string; created_at: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await service.from("pool_contributions")
      .select("id, amount, contributor_id, created_at")
      .eq("pool_id", poolId).eq("status", "paid").eq("applied_to_pool", true)
      .order("created_at", { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []) as typeof rows);
    if (!data || data.length < 1000) break;
  }
  return rows;
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
  const context = await getPool(poolId);
  if (!context) return;
  const contributions = await getAppliedContributions(poolId);
  const firstContributionByUser = new Map<string, (typeof contributions)[number]>();
  for (const contribution of contributions) {
    if (!firstContributionByUser.has(contribution.contributor_id)) {
      firstContributionByUser.set(contribution.contributor_id, contribution);
    }
  }
  await Promise.all([...firstContributionByUser.values()].map(async (contribution) => {
    const contact = await getContact(contribution.contributor_id);
    if (!contact.email) return;
    await requireEmailDelivery(sendPoolCashedOutEmail({
      to: contact.email,
      poolTitle: context.pool.title,
      cashedOutAmount: context.pool.cashed_out_amount ?? context.pool.amount_raised,
      contributorCount: firstContributionByUser.size,
      poolUrl: context.url,
      contributionId: contribution.id,
    }));
  }));
}
