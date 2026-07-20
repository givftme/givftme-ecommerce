import { notFound, redirect } from "next/navigation";
import {
  OrderConfirmationScreen,
  type ConfirmedOrder,
} from "@/components/order/OrderConfirmationScreen";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", `/account/orders/${id}`));
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, created_at, shipping_name, shipping_city, shipping_state, order_items(id, product_title, product_image_url, quantity, unit_price)"
    )
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle();

    if (error) {
    console.error("Could not load order for account order page.", error);
    throw new Error("Couldn't load this order. Please try again.");
  }

  const order = data as (ConfirmedOrder & { status: string }) | null;

  if (!order) {
    notFound();
  }

  if (order.status === "pending_payment") {
    redirect(`/checkout/processing?order=${order.id}`);
  }

  if (order.status === "payment_failed") {
    redirect(`/checkout/failed?order=${order.id}`);
  }

  return (
    <PageWrapper isAuthenticated>
      <OrderConfirmationScreen order={order} />
    </PageWrapper>
  );
}
