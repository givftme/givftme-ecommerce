import { NextResponse } from "next/server";
import { recordRequestEvent } from "@/lib/events/server";
import { trackEvent } from "@/lib/analytics";
import { jsonError } from "@/lib/api/response";
import { poolRpcError } from "@/lib/pools/errors";
import { sendPoolCashedOut } from "@/lib/pools/notifications";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface PoolActionContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: PoolActionContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const { data, error } = await supabase.rpc("gifvtme_cash_out_group_gift_pool", { p_pool_id: id });
  if (error) {
    const mapped = poolRpcError(error);
    if (mapped.status !== 500) return jsonError(mapped.error, mapped.status);
    console.error("Could not cash out group gift pool.", error);
    return jsonError(mapped.error, mapped.status);
  }

  const result = data as { amount?: number; already_paid_out?: boolean } | null;
  if (!result || typeof result.amount !== "number") return jsonError("Couldn't cash out this pool.", 500);
  try {
    await sendPoolCashedOut(id);
  } catch (notificationError) {
    console.error("Pool was cashed out but contributor email delivery failed.", notificationError);
  }
  if (!result.already_paid_out) {
    const service = createServiceClient();
    const { data: pool } = await service.from("group_gift_pools")
      .select("target_amount, wishlist_item_id").eq("id", id).maybeSingle();
    const targetAmount = Number(pool?.target_amount ?? 0);
    trackEvent("pool.cashed_out", {
      pool_id: id,
      amount_raised: result.amount,
      target_amount: targetAmount,
      percentage_funded: targetAmount > 0 ? Math.min(100, Math.round(result.amount / targetAmount * 100)) : 0,
    });
    await recordRequestEvent({
      event: "pool_payout_requested",
      userId: user.id,
      props: { pool_id: id, amount: result.amount, pool_type: pool?.wishlist_item_id ? "item" : "general" },
    });
  }

  return NextResponse.json({ cashed_out: true, amount: result.amount });
}
