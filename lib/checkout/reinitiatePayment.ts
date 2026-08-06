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

/**
 * Shared by /api/checkout/retry and /api/checkout's idempotency-key replay
 * path — both re-initiate Flutterwave payment for an already-created order
 * rather than creating a new one.
 */
export async function reinitiateOrderPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  if (order.status === "payment_failed") {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "pending_payment" })
      .eq("id", order.id)
      .eq("buyer_id", order.buyer_id);

    if (statusError) {
      return {
        ok: false,
        status: 500,
        error: "Couldn't prepare this order for retry.",
      };
    }
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
      return { ok: false, status: 502, error: "Payment couldn't start - try again." };
    }

    return { ok: true, paymentLink: payment.paymentLink };
  } catch (error) {
    console.error("Flutterwave re-initiation failed.", error);
    return { ok: false, status: 502, error: "Payment couldn't start - try again." };
  }
}
