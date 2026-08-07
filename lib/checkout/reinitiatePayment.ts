import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { isAllowedFlutterwavePaymentLink } from "@/lib/flutterwave/paymentLink";
import type { PaymentPreference } from "@/lib/checkout/validation";
import type { createClient } from "@/lib/supabase/server";

export interface ReinitiatableOrder {
  id: string;
  buyer_id: string;
  total_amount: number;
  currency: string;
  status: string;
  shipping_email: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
}

export type ReinitiatePaymentResult =
  | { ok: true; paymentLink: string }
  | { ok: false; status: number; error: string };

// A Flutterwave initiation call is one fast HTTP request (15s timeout, see
// lib/flutterwave/index.ts) — a claim older than this is assumed abandoned
// (the request that took it crashed or the tab was closed) rather than
// still in progress, and can be re-claimed. Short on purpose: unlike the
// reminders/thank-you cron claims (10 min stale window), this guards an
// interactive, user-facing retry, so a genuinely stuck claim shouldn't
// block the buyer for long.
const PAYMENT_CLAIM_STALE_MS = 2 * 60 * 1000;

function paymentClaimStaleThresholdIso() {
  return new Date(Date.now() - PAYMENT_CLAIM_STALE_MS).toISOString();
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Atomically claims the order for a payment-initiation attempt and, in the
// same update, flips a stale `payment_failed` order back to
// `pending_payment`. Without this, two concurrent calls (a double-click on
// "Try again", or two idempotency-key replays racing) could both pass the
// status check and each start an independent Flutterwave payment session
// for the same order — if a buyer completed both, they'd be charged twice,
// even though the DB only ever marks the order `confirmed` once. Mirrors
// the claimed_at compare-and-set pattern already used for reminders/
// thank-you cron rows (app/api/reminders/route.ts's claimReminder).
async function claimOrderForPayment(
  supabase: SupabaseClient,
  orderId: string,
  buyerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "pending_payment", payment_claimed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("buyer_id", buyerId)
    .in("status", ["pending_payment", "payment_failed"])
    .or(`payment_claimed_at.is.null,payment_claimed_at.lt.${paymentClaimStaleThresholdIso()}`)
    .select("id");

  if (error) {
    console.error("Couldn't claim order for payment.", { orderId, error });
    return false;
  }

  return Boolean(data && data.length > 0);
}

// Exported so the fresh-order creation path (POST /api/checkout) can also
// release its own initial claim — set by gifvtme_create_checkout_order,
// migration 018 — if its first Flutterwave call fails, rather than leaving
// a legitimate immediate retry blocked for the full stale window.
export async function releasePaymentClaim(
  supabase: SupabaseClient,
  orderId: string,
  buyerId: string
) {
  const { error } = await supabase
    .from("orders")
    .update({ payment_claimed_at: null })
    .eq("id", orderId)
    .eq("buyer_id", buyerId);

  if (error) {
    console.error("Couldn't release order payment claim.", { orderId, error });
  }
}

/**
 * Shared by /api/checkout/retry and /api/checkout's idempotency-key replay
 * path — both re-initiate Flutterwave payment for an already-created order
 * rather than creating a new one.
 */
export async function reinitiateOrderPayment(
  supabase: SupabaseClient,
  order: ReinitiatableOrder,
  preferredPayment?: PaymentPreference
): Promise<ReinitiatePaymentResult> {
  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    return { ok: false, status: 400, error: "This order cannot be retried" };
  }

  if (order.currency !== "NGN" || order.total_amount <= 0) {
    return { ok: false, status: 400, error: "This order cannot be retried" };
  }

  if (!order.shipping_email || !order.shipping_name || !order.shipping_phone) {
    return {
      ok: false,
      status: 400,
      error: "This order is missing payment details.",
    };
  }

  const claimed = await claimOrderForPayment(supabase, order.id, order.buyer_id);

  if (!claimed) {
    // Either another request already has an active, non-stale claim on
    // this order, or its status moved on (e.g. the webhook just confirmed
    // it) between the caller's lookup and this claim attempt.
    return {
      ok: false,
      status: 409,
      error: "A payment is already being started for this order — please wait a moment and try again.",
    };
  }

  try {
    const payment = await initiateFlutterwavePayment({
      orderId: order.id,
      amount: order.total_amount,
      customer: {
        email: order.shipping_email,
        name: order.shipping_name,
        phone: order.shipping_phone,
      },
      preferredPayment,
    });

    if (!payment.ok || !isAllowedFlutterwavePaymentLink(payment.paymentLink)) {
      await releasePaymentClaim(supabase, order.id, order.buyer_id);
      return { ok: false, status: 502, error: "Payment couldn't start - try again." };
    }

    return { ok: true, paymentLink: payment.paymentLink };
  } catch (error) {
    console.error("Flutterwave re-initiation failed.", error);
    await releasePaymentClaim(supabase, order.id, order.buyer_id);
    return { ok: false, status: 502, error: "Payment couldn't start - try again." };
  }
}
