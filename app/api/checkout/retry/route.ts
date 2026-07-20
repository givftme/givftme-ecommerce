import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/response";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { isAllowedFlutterwavePaymentLink } from "@/lib/flutterwave/paymentLink";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

const retryOrderSchema = z.string().uuid();

interface RetryOrderRow {
  id: string;
  buyer_id: string;
  total_amount: number;
  currency: string;
  status: string;
  shipping_email: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const parsedOrderId = retryOrderSchema.safeParse(
    request.nextUrl.searchParams.get("order")
  );

  if (!parsedOrderId.success) {
    return jsonError("Invalid order.", 400);
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, total_amount, currency, status, shipping_email, shipping_name, shipping_phone"
    )
    .eq("id", parsedOrderId.data)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (error) {
    return jsonError("Couldn't load this order.", 500);
  }

  const order = data as RetryOrderRow | null;

  if (!order) {
    return jsonError("Order not found.", 404);
  }

  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    return jsonError("This order cannot be retried", 400);
  }

  if (order.currency !== "NGN" || order.total_amount <= 0) {
    return jsonError("This order cannot be retried", 400);
  }

  if (!order.shipping_email || !order.shipping_name || !order.shipping_phone) {
    return jsonError("This order is missing payment details.", 400);
  }

  if (order.status === "payment_failed") {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "pending_payment" })
      .eq("id", order.id)
      .eq("buyer_id", user.id);

    if (statusError) {
      return jsonError("Couldn't prepare this order for retry.", 500);
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
    });

    if (
      !payment.ok ||
      !isAllowedFlutterwavePaymentLink(payment.paymentLink)
    ) {
      return jsonError("Payment couldn't start - try again.", 502);
    }

    return NextResponse.json({
      order_id: order.id,
      payment_link: payment.paymentLink,
    });
  } catch (error) {
    console.error("Flutterwave retry failed.", error);
    return jsonError("Payment couldn't start - try again.", 502);
  }
}
