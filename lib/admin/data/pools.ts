import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/admin/audit";
import { namesForUsers } from "@/lib/admin/data/orders";
import type { PayoutUpdate } from "@/lib/admin/validation";

export interface AdminPoolRow {
  id: string;
  title: string;
  token: string;
  status: "open" | "fully_funded";
  type: "item" | "general";
  receiver_name: string | null;
  target_amount: number;
  amount_raised: number;
  percent: number;
  contributor_count: number;
  created_at: string;
}

type MaybeArray<T> = T | T[] | null;
const first = <T,>(value: MaybeArray<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

export async function listActivePools(service: SupabaseClient): Promise<AdminPoolRow[]> {
  const { data, error } = await service
    .from("group_gift_pools")
    .select("id, title, token, status, wishlist_item_id, receiver_id, target_amount, amount_raised, created_at, group_gift_pool_progress(contributor_count)")
    .in("status", ["open", "fully_funded"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const receivers = await namesForUsers(service, (data || []).map((pool) => pool.receiver_id));
  return (data || []).map((pool) => {
    const target = Number(pool.target_amount);
    const raised = Number(pool.amount_raised);
    const progress = first(pool.group_gift_pool_progress as MaybeArray<{ contributor_count: number }>);
    return {
      id: pool.id,
      title: pool.title,
      token: pool.token,
      status: pool.status,
      type: pool.wishlist_item_id ? "item" : "general",
      receiver_name: receivers.get(pool.receiver_id)?.full_name ?? null,
      target_amount: target,
      amount_raised: raised,
      percent: target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0,
      contributor_count: Number(progress?.contributor_count ?? 0),
      created_at: pool.created_at,
    };
  });
}

export interface PayoutQueueRow {
  id: string;
  pool_id: string;
  pool_title: string | null;
  receiver_name: string | null;
  receiver_email: string | null;
  amount: number;
  status: "pending_ops_action" | "processing";
  created_at: string;
}

/**
 * Payouts awaiting a transfer, oldest first. Includes `processing` as well as
 * `pending_ops_action`, so a payout marked processing stays in the queue until
 * someone records the completed transfer.
 */
export async function listPayoutQueue(service: SupabaseClient): Promise<PayoutQueueRow[]> {
  const { data, error } = await service
    .from("pool_payouts")
    .select("id, pool_id, receiver_id, amount, status, created_at, group_gift_pools(title)")
    .in("status", ["pending_ops_action", "processing"])
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const receivers = await namesForUsers(service, (data || []).map((payout) => payout.receiver_id));
  return (data || []).map((payout) => {
    const receiver = receivers.get(payout.receiver_id);
    return {
      id: payout.id,
      pool_id: payout.pool_id,
      pool_title: first(payout.group_gift_pools as MaybeArray<{ title: string }>)?.title ?? null,
      receiver_name: receiver?.full_name ?? null,
      receiver_email: receiver?.email ?? null,
      amount: Number(payout.amount),
      status: payout.status,
      created_at: payout.created_at,
    };
  });
}

export type PayoutUpdateResult = { ok: true } | { ok: false; status: number; error: string };

const ALLOWED_FROM: Record<PayoutUpdate["status"], string[]> = {
  processing: ["pending_ops_action"],
  completed: ["pending_ops_action", "processing"],
};

/** Records ops progress on a manual bank transfer (BUSINESS_RULES rule 19). */
export async function updatePayout(
  service: SupabaseClient,
  admin: { id: string; email: string },
  payoutId: string,
  input: PayoutUpdate,
): Promise<PayoutUpdateResult> {
  const { data: payout, error } = await service
    .from("pool_payouts").select("id, status, pool_id, amount").eq("id", payoutId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!payout) return { ok: false, status: 404, error: "Payout not found." };
  if (!ALLOWED_FROM[input.status].includes(payout.status)) {
    return { ok: false, status: 409, error: `This payout is already ${payout.status.replace(/_/g, " ")}.` };
  }

  const changes: Record<string, unknown> = { status: input.status };
  if (input.status === "completed") {
    Object.assign(changes, {
      bank_name: input.bank_name,
      account_number: input.account_number,
      account_name: input.account_name,
      reference: input.reference,
      processed_by: admin.email || admin.id,
      processed_at: new Date().toISOString(),
    });
  }

  const { data: updated, error: updateError } = await service
    .from("pool_payouts").update(changes).eq("id", payoutId).eq("status", payout.status).select("id");
  if (updateError) {
    console.error("Could not update pool payout.", updateError);
    return { ok: false, status: 500, error: "Couldn't update the payout. Try again." };
  }
  if (!updated?.length) return { ok: false, status: 409, error: "This payout changed since you opened it. Reload and try again." };

  await logAdminAction(service, admin.id, {
    action: input.status === "completed" ? "complete_payout" : "mark_payout_processing",
    targetType: "pool_payout",
    targetId: payoutId,
    metadata: {
      pool_id: payout.pool_id,
      amount: Number(payout.amount),
      from: payout.status,
      to: input.status,
      ...(input.status === "completed"
        ? { bank_name: input.bank_name, account_last4: input.account_number.slice(-4), reference: input.reference }
        : {}),
    },
  });
  return { ok: true };
}
