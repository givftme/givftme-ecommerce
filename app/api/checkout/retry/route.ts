import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/response";
import {
  reinitiateOrderPayment,
  type ReinitiatableOrder,
} from "@/lib/checkout/reinitiatePayment";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

const retryOrderSchema = z.string().uuid();

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

  const order = data as ReinitiatableOrder | null;

  if (!order) {
    return jsonError("Order not found.", 404);
  }

  const result = await reinitiateOrderPayment(supabase, order);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({
    order_id: order.id,
    payment_link: result.paymentLink,
  });
}
