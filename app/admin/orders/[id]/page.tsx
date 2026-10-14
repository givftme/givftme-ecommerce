import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader, DataTable, Panel, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { OrderStatusPanel } from "@/components/admin/OrderStatusPanel";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { isUuid, requireAdminScreen } from "@/lib/admin/auth";
import { getAdminOrder } from "@/lib/admin/data/orders";
import { formatAdminDate, formatAdminDateTime, humanize, shortId } from "@/lib/admin/format";
import { canPerform } from "@/lib/admin/roles";
import type { OrderStatus } from "@/lib/orders/types";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const member = await requireAdminScreen("orders", {
    path: `/admin/orders/${id}`,
    action: "view_order",
    targetType: "order",
    targetId: id,
  });
  const order = await getAdminOrder(createServiceClient(), id);
  if (!order) notFound();

  const address = [order.shipping_address, order.shipping_city, order.shipping_state].filter(Boolean).join(", ");
  const canUpdate = canPerform(member.role, "updateOrderStatus");

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All orders
      </Link>
      <AdminPageHeader
        title={`Order #${shortId(order.id)}`}
        description={`Placed ${formatAdminDateTime(order.created_at)}${order.wishlist_item_id ? " · gift from a wishlist" : ""}`}
        actions={<OrderStatusBadge status={order.status as OrderStatus} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Line items" description="Prices as charged at checkout.">
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Item</th>
                  <th className={thNum}>Qty</th>
                  <th className={thNum}>Unit price</th>
                  <th className={thNum}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className={td}>{item.product_title}</td>
                    <td className={tdNum}>{item.quantity}</td>
                    <td className={tdNum}>{formatPrice(item.unit_price)}</td>
                    <td className={tdNum}>{formatPrice(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${td} font-semibold`} colSpan={3}>Order total</td>
                  <td className={`${tdNum} font-semibold`}>{formatPrice(order.total_amount)}</td>
                </tr>
              </tbody>
            </DataTable>
          </Panel>

          <Panel title="Status history">
            {order.history.length === 0 ? (
              <p className="text-sm text-muted">No status changes recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {order.history.map((entry) => (
                  <li key={entry.id}>
                    <span aria-hidden="true" className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-semibold text-ink">{humanize(entry.status)}</p>
                    <p className="text-xs text-muted">
                      {formatAdminDateTime(entry.changed_at)} · {entry.customer_notified ? "customer emailed" : "email pending"}
                    </p>
                    {entry.notes ? <p className="mt-1 whitespace-pre-line text-sm text-ink">{entry.notes}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {order.changes.length ? (
            <Panel title="Changed by" description="Admin actions on this order.">
              <ul className="space-y-2 text-sm">
                {order.changes.map((change, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2">
                    <span className="text-ink">
                      {change.admin_name ?? "Team member"} · {humanize(change.action)}
                      {typeof change.metadata.to === "string" ? ` → ${humanize(change.metadata.to)}` : ""}
                    </span>
                    <span className="text-xs text-muted">{formatAdminDateTime(change.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          {canUpdate ? (
            <Panel title="Update status">
              <OrderStatusPanel
                orderId={order.id}
                nextStatuses={order.nextStatuses}
                tracking={{ number: order.tracking_number, carrier: order.carrier_name, url: order.tracking_url }}
              />
            </Panel>
          ) : null}
          <Panel title="Buyer">
            {order.buyer ? (
              <div className="space-y-1 text-sm">
                <Link href={`/admin/people/${order.buyer.id}`} className="font-semibold text-brand hover:underline">{order.buyer.full_name ?? "Unnamed"}</Link>
                <p className="break-all text-muted">{order.buyer.email ?? "—"}</p>
                <p className="text-muted">{order.buyer.phone ?? "—"}</p>
              </div>
            ) : <p className="text-sm text-muted">Account no longer exists.</p>}
          </Panel>
          <Panel title="Shipping">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-ink">{order.shipping_name ?? "—"}</p>
              <p className="text-muted">{order.shipping_phone ?? "—"}</p>
              <p className="text-ink">{address || "—"}</p>
              <p className="pt-2 text-muted">Estimated delivery: {formatAdminDate(order.estimated_delivery)}</p>
              {order.tracking_number ? (
                <p className="text-muted">
                  Tracking: {order.carrier_name ? `${order.carrier_name} · ` : ""}{order.tracking_number}
                  {order.tracking_url ? <> · <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">open</a></> : null}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
