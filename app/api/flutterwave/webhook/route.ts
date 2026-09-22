import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import {
  getOrderIdFromFlutterwaveMeta,
  getOrderIdFromFlutterwaveReference,
} from "@/lib/flutterwave/paymentReference";
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

  const orderId =
    getOrderIdFromFlutterwaveMeta(payload.data?.meta) ??
    getOrderIdFromFlutterwaveReference(payload.data?.tx_ref);

  if (!orderId) {
    return ok();
  }

  const supabase = createServiceClient();
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

  if (succeeded) {
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
