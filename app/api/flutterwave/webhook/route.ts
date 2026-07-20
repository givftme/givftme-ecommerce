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

  if (!order || order.status !== "pending_payment") {
    return ok();
  }

  const txId = payload.data?.id != null ? String(payload.data.id) : null;

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

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        flutterwave_tx_id: txId,
        flutterwave_tx_ref: payload.data.tx_ref,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Could not confirm Flutterwave order.", updateError);
      return ok();
    }

    if (order.wishlist_item_id) {
      const { error: itemUpdateError } = await supabase
        .from("wishlist_items")
        .update({ status: "purchased" })
        .eq("id", order.wishlist_item_id);

      if (itemUpdateError) {
        console.error("Could not mark wishlist item purchased.", itemUpdateError);
      }

      const { data: wishlistItem, error: wishlistItemError } = await supabase
        .from("wishlist_items")
        .select("master_item_id")
        .eq("id", order.wishlist_item_id)
        .maybeSingle();

      if (wishlistItemError) {
        console.error("Could not load linked master item.", wishlistItemError);
      }

      const masterItemId = (wishlistItem as { master_item_id?: string | null } | null)
        ?.master_item_id;

      if (masterItemId) {
        const { error: masterUpdateError } = await supabase
          .from("master_items")
          .update({ status: "purchased" })
          .eq("id", masterItemId);

        if (masterUpdateError) {
          console.error("Could not mark master item purchased.", masterUpdateError);
        }
      }
    }

    return ok();
  }

  const { error: failedError } = await supabase
    .from("orders")
    .update({
      status: "payment_failed",
      flutterwave_tx_id: txId,
    })
    .eq("id", order.id);

  if (failedError) {
    console.error("Could not mark Flutterwave order failed.", failedError);
  }

  return ok();
}
