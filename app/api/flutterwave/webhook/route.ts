import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import {
  getOrderIdFromFlutterwaveMeta,
  getOrderIdFromFlutterwaveReference,
} from "@/lib/flutterwave/paymentReference";
import { trackEvent } from "@/lib/analytics";
import {
  sendPoolCashedOut,
  sendContributionReceipt as sendPoolContributionReceipt,
  sendPoolFullyFunded,
} from "@/lib/pools/notifications";
import { createServiceClient } from "@/lib/supabase/server";

interface FlutterwaveWebhookPayload {
  event?: string;
  data?: {
    id?: string | number;
    tx_ref?: string;
    status?: string;
    amount?: string | number;
    currency?: string;
    meta?: unknown;
  };
}

interface WebhookOrderRow {
  id: string;
  status: string;
  total_amount: string | number;
  currency: string;
  flutterwave_tx_ref: string | null;
  wishlist_item_id: string | null;
  buyer_id: string;
}

function ok() {
  return NextResponse.json({ received: true });
}

function normalizeAmount(value: string | number | null | undefined) {
  const amount =
    typeof value === "string" && value.trim()
      ? Number(value.trim())
      : value;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

function paymentMatchesOrder(
  payment: FlutterwaveWebhookPayload["data"],
  order: WebhookOrderRow
) {
  const paymentAmount = normalizeAmount(payment?.amount);
  const orderAmount = normalizeAmount(order.total_amount);
  const paymentCurrency = payment?.currency?.trim().toUpperCase();
  const orderCurrency = order.currency.trim().toUpperCase();

  return (
    paymentAmount !== null &&
    orderAmount !== null &&
    paymentAmount === orderAmount &&
    paymentCurrency === orderCurrency
  );
}

function getPoolContributionId(payload: FlutterwaveWebhookPayload) {
  const meta = payload.data?.meta;
  if (typeof meta === "object" && meta !== null) {
    const value = (meta as Record<string, unknown>).pool_contribution_id;
    if (typeof value === "string" && value) return value;
  }
  return payload.data?.tx_ref ?? null;
}

function paymentMatchesPoolContribution(
  payment: FlutterwaveWebhookPayload["data"],
  contributionAmount: number | string
) {
  const paymentAmount = normalizeAmount(payment?.amount);
  const expectedAmount = normalizeAmount(contributionAmount);
  return (
    paymentAmount !== null &&
    expectedAmount !== null &&
    paymentAmount === expectedAmount &&
    payment?.currency?.trim().toUpperCase() === "NGN"
  );
}

async function handlePoolContributionWebhook(
  supabase: ReturnType<typeof createServiceClient>,
  payload: FlutterwaveWebhookPayload
) {
  const contributionId = getPoolContributionId(payload);
  if (!contributionId) return false;

  const { data: contribution, error } = await supabase
    .from("pool_contributions")
    .select("id, pool_id, amount, status")
    .eq("id", contributionId)
    .maybeSingle();
  if (error) {
    console.error("Could not load Flutterwave pool contribution.", error);
    throw error;
  }
  if (!contribution) return false;

  const txId = payload.data?.id != null ? String(payload.data.id) : null;
  if (payload.data?.status !== "successful") {
    const { error: failError } = await supabase.rpc("gifvtme_fail_group_pool_contribution", {
      p_contribution_id: contribution.id,
    });
    if (failError) throw failError;
    return true;
  }

  if (!paymentMatchesPoolContribution(payload.data, contribution.amount)) {
    console.error("Rejected Flutterwave pool confirmation with mismatched amount or currency.", {
      contributionId: contribution.id,
      expectedAmount: contribution.amount,
      receivedAmount: payload.data?.amount ?? null,
      receivedCurrency: payload.data?.currency ?? null,
    });
    return true;
  }
  if (payload.data?.tx_ref !== contribution.id || !txId) {
    console.error("Rejected Flutterwave pool confirmation with a mismatched reference or missing transaction id.", {
      contributionId: contribution.id,
      receivedReference: payload.data?.tx_ref ?? null,
      hasTransactionId: Boolean(txId),
    });
    return true;
  }

  const { data: confirmValue, error: confirmError } = await supabase.rpc(
    "gifvtme_confirm_group_pool_contribution",
    { p_contribution_id: contribution.id, p_transaction_id: txId }
  );
  if (confirmError) {
    console.error("Could not confirm Flutterwave pool contribution.", confirmError);
    throw confirmError;
  }

  const confirmation = confirmValue as {
    outcome?: string;
    pool_id?: string;
    newly_funded?: boolean;
    refund_required?: boolean;
    pool_status?: string;
  } | null;
  if (confirmation?.outcome !== "paid" && confirmation?.outcome !== "already_paid") return true;

  const refundRequired = confirmation.refund_required === true;
  const { data: pool, error: poolError } = await supabase.from("group_gift_pools")
    .select("amount_raised, target_amount, status, created_at, fully_funded_at")
    .eq("id", contribution.pool_id)
    .maybeSingle();
  if (poolError) throw poolError;

  await sendPoolContributionReceipt(contribution.id, contribution.pool_id, refundRequired);
  if (pool?.fully_funded_at) await sendPoolFullyFunded(contribution.pool_id);
  if (pool?.status === "paid_out") await sendPoolCashedOut(contribution.pool_id);

  if (confirmation.outcome === "already_paid") return true;

  const raised = Number(pool?.amount_raised ?? 0);
  const target = Number(pool?.target_amount ?? 0);
  trackEvent("pool.contribution.completed", {
    pool_id: contribution.pool_id,
    amount: Number(contribution.amount),
    pool_percentage_after: target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0,
  });
  if (confirmation.newly_funded) {
    const { data: progress } = await supabase.from("group_gift_pool_progress")
      .select("contributor_count").eq("pool_id", contribution.pool_id).maybeSingle();
    const contributorCount = Number(progress?.contributor_count ?? 0);
    const createdAt = pool?.created_at ? new Date(pool.created_at).getTime() : Date.now();
    const fundedAt = pool?.fully_funded_at ? new Date(pool.fully_funded_at).getTime() : Date.now();
    trackEvent("pool.fully_funded", {
      pool_id: contribution.pool_id,
      contributor_count: contributorCount,
      days_to_fund: Math.max(0, Math.floor((fundedAt - createdAt) / 86_400_000)),
    });
    if (confirmation.pool_status === "paid_out") {
      trackEvent("pool.cashed_out", {
        pool_id: contribution.pool_id,
        amount_raised: raised,
        target_amount: target,
        percentage_funded: target > 0 ? Math.min(100, Math.round(raised / target * 100)) : 0,
      });
    }
  }
  return true;
}

export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");
  const secretHash = requireEnv(
    process.env.FLUTTERWAVE_SECRET_HASH,
    "FLUTTERWAVE_SECRET_HASH"
  );

  if (signature !== secretHash) {
    console.warn("Rejected Flutterwave webhook with invalid signature.");
    return new NextResponse(null, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | FlutterwaveWebhookPayload
    | null;

  if (!payload || payload.event !== "charge.completed") {
    return ok();
  }

  const supabase = createServiceClient();
  let handledPool: boolean;
  try {
    handledPool = await handlePoolContributionWebhook(supabase, payload);
  } catch (poolError) {
    console.error("Could not finish Flutterwave pool webhook processing.", poolError);
    return NextResponse.json({ error: "Pool webhook processing should be retried." }, { status: 500 });
  }
  if (handledPool) return ok();

  const orderId =
    getOrderIdFromFlutterwaveMeta(payload.data?.meta) ??
    getOrderIdFromFlutterwaveReference(payload.data?.tx_ref);

  if (!orderId) {
    return ok();
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, currency, flutterwave_tx_ref, wishlist_item_id, buyer_id"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Could not load Flutterwave webhook order.", error);
    return ok();
  }

  const order = data as WebhookOrderRow | null;

  if (!order) {
    return ok();
  }

  const txId = payload.data?.id != null ? String(payload.data.id) : null;
  const succeeded = payload.data?.status === "successful";

  // A buyer can try another card on the same Flutterwave page after a
  // decline, so a success can arrive after a failure already moved the
  // order to payment_failed. That success is captured money and must
  // still confirm. A failure only ever moves a pending order.
  const actionableStatuses = succeeded
    ? ["pending_payment", "payment_failed"]
    : ["pending_payment"];

  if (!actionableStatuses.includes(order.status)) {
    return ok();
  }

  if (payload.data?.status === "successful") {
    if (!paymentMatchesOrder(payload.data, order)) {
      console.error("Rejected Flutterwave confirmation with mismatched amount or currency.", {
        orderId: order.id,
        expectedAmount: order.total_amount,
        receivedAmount: payload.data.amount ?? null,
        expectedCurrency: order.currency,
        receivedCurrency: payload.data.currency ?? null,
      });

      return ok();
    }

    // One RPC, one Postgres transaction. This used to be four sequential
    // REST calls whose failures were console.error and nothing else, so a
    // blip between them could leave a paid order with its wishlist item
    // still showing as available and no path that repaired it. The claim's
    // move to 'purchased' happens inside this same transaction, and this
    // is the only place in the product that can make that move at all
    // (spec 0002, AC-19).
    const { data: confirmData, error: confirmError } = await supabase.rpc(
      "gifvtme_confirm_gift_order",
      {
        p_order_id: order.id,
        p_tx_id: txId,
        p_tx_ref: payload.data.tx_ref ?? null,
      }
    );

    if (confirmError) {
      console.error("Could not confirm Flutterwave order.", confirmError);
      return ok();
    }

    const confirmResult = confirmData as {
      outcome?: string;
      already_confirmed?: boolean;
      claim_conflict?: boolean;
    } | null;

    if (confirmResult?.claim_conflict) {
      // The money was captured, so the order stands. The reservation had
      // already lapsed and somebody else may hold the item now, so this
      // needs a person rather than an automatic overwrite (spec AC-34).
      console.error("Confirmed a gift order whose claim had moved on.", {
        orderId: order.id,
      });
    }

    return ok();
  }

  const { error: failedError } = await supabase.rpc("gifvtme_fail_gift_order", {
    p_order_id: order.id,
    p_tx_id: txId,
  });

  if (failedError) {
    console.error("Could not mark Flutterwave order failed.", failedError);
  }

  return ok();
}
