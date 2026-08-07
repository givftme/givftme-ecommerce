import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Gift } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { OrderTracking } from "@/components/order/OrderTracking";
import { TrackingLink } from "@/components/order/TrackingLink";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { trackEvent } from "@/lib/analytics";
import { withRedirect } from "@/lib/auth/redirect";
import { getOrderDetail } from "@/lib/orders/server";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Payment pending",
  payment_failed: "Payment failed",
  confirmed: "Order confirmed",
  under_review: "Under review",
  forwarded: "Forwarded to supplier",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function AccountOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", `/account/orders/${id}`));
  }

  let order;
  try {
    order = await getOrderDetail(supabase, id, user.id);
  } catch (error) {
    console.error("Could not load order for account order page.", error);
    throw new Error("Couldn't load this order. Please try again.");
  }

  if (!order) {
    // pending_payment/payment_failed orders aren't fetched by
    // getOrderDetail (they're excluded from the tracked statuses) — check
    // separately so checkout can still redirect here mid-flow.
    const { data: pendingOrder, error: pendingOrderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .eq("buyer_id", user.id)
      .maybeSingle();
    
    if (pendingOrderError) {
      console.error("Could not load pending order for account order page.", pendingOrderError);
      throw new Error("Couldn't load this order. Please try again.");
    }

    if (pendingOrder?.status === "pending_payment") {
      redirect(`/checkout/processing?order=${pendingOrder.id}`);
    }

    if (pendingOrder?.status === "payment_failed") {
      redirect(`/checkout/failed?order=${pendingOrder.id}`);
    }

    notFound();
  }

  trackEvent("order.detail.viewed", { order_id: order.id, status: order.status });

  const fullAddress = [order.shipping_address, order.shipping_city, order.shipping_state]
    .filter(Boolean)
    .join(", ");
  const showTracking = order.status === "shipped" || order.status === "delivered";

  return (
    <PageWrapper isAuthenticated>
      <section className="bg-surface py-10">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-ink md:text-3xl">
                Order #{order.id.slice(-8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Placed {formatDate(order.created_at)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm md:p-6">
            <OrderTracking status={order.status} />
          </div>

          {showTracking && (
            <div className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">Tracking</h2>
              {order.tracking_number ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-ink">
                    <span className="text-muted">Carrier:</span>{" "}
                    {order.carrier_name || "—"}
                  </p>
                  <p className="text-ink">
                    <span className="text-muted">Tracking number:</span>{" "}
                    {order.tracking_number}
                  </p>
                  {order.estimated_delivery && (
                    <p className="text-ink">
                      <span className="text-muted">Estimated delivery:</span>{" "}
                      {formatDate(order.estimated_delivery)}
                    </p>
                  )}
                  {order.tracking_url && (
                    <div className="pt-1">
                      <TrackingLink
                        href={order.tracking_url}
                        carrierName={order.carrier_name}
                        orderId={order.id}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Tracking details will appear once your order ships.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Order summary</h2>
            <div className="mt-3 divide-y divide-stone-100">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {item.product_image_url ? (
                      <Image
                        src={item.product_image_url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gift className="h-6 w-6 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {item.product_title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Qty {item.quantity} × {formatPrice(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {formatPrice(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <dl className="space-y-2 border-t border-stone-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold text-ink">
                  {formatPrice(order.total_amount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-semibold text-green-700">
                  {formatPrice(0)}
                </dd>
              </div>
              <div className="flex items-end justify-between border-t border-stone-100 pt-3">
                <dt className="text-base font-semibold text-ink">Total</dt>
                <dd className="text-xl font-bold text-brand">
                  {formatPrice(order.total_amount)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Shipping details</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <p className="text-ink">{order.shipping_name || "—"}</p>
              <p className="text-muted">{order.shipping_phone || "—"}</p>
              <p className="text-muted">{fullAddress || "—"}</p>
            </dl>
          </div>

          <details className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-lg font-semibold text-ink">
              Order timeline
            </summary>
            <div className="mt-4 space-y-4">
              {order.order_status_history.length === 0 ? (
                <p className="text-sm text-muted">No status history yet.</p>
              ) : (
                order.order_status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-l-2 border-brand-light pl-4"
                  >
                    <p className="text-sm font-semibold text-ink">
                      {STATUS_LABELS[entry.status] || entry.status}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(entry.changed_at, true)}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 text-sm text-muted">{entry.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </section>
    </PageWrapper>
  );
}
