import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, DataTable, EmptyState, fieldLabel, Panel, selectClass, smallInput, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { Button } from "@/components/ui/Button";
import { requireAdminScreen } from "@/lib/admin/auth";
import { listAdminOrders, ORDER_FILTER_STATUSES, parseOrderFilters, type OrderFilters } from "@/lib/admin/data/orders";
import { formatAdminDate, humanize, shortId } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function pageHref(filters: OrderFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.city) params.set("city", filters.city);
  if (filters.min != null) params.set("min", String(filters.min));
  if (filters.max != null) params.set("max", String(filters.max));
  if (filters.late) params.set("late", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/orders${query ? `?${query}` : ""}`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Search }) {
  await requireAdminScreen("orders", { path: "/admin/orders" });
  const filters = parseOrderFilters(await searchParams);
  const { orders, total, page, pageCount } = await listAdminOrders(createServiceClient(), filters);

  return (
    <>
      <AdminPageHeader title="Orders & Operations" description={`${total.toLocaleString("en-NG")} catalog orders match. Open an order to move it through fulfilment.`} />

      <Panel className="mb-6">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" action="/admin/orders">
          <div>
            <label htmlFor="status" className={fieldLabel}>Status</label>
            <select id="status" name="status" defaultValue={filters.status} className={selectClass}>
              {ORDER_FILTER_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="from" className={fieldLabel}>Placed from</label>
            <input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className={smallInput} />
          </div>
          <div>
            <label htmlFor="to" className={fieldLabel}>Placed to</label>
            <input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className={smallInput} />
          </div>
          <div>
            <label htmlFor="city" className={fieldLabel}>City</label>
            <input id="city" name="city" defaultValue={filters.city ?? ""} placeholder="e.g. Ikeja" className={smallInput} />
          </div>
          <div>
            <label htmlFor="min" className={fieldLabel}>Min ₦</label>
            <input id="min" name="min" type="number" min={0} inputMode="numeric" defaultValue={filters.min ?? ""} className={smallInput} />
          </div>
          <div>
            <label htmlFor="max" className={fieldLabel}>Max ₦</label>
            <input id="max" name="max" type="number" min={0} inputMode="numeric" defaultValue={filters.max ?? ""} className={smallInput} />
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-1">
            {filters.late ? <input type="hidden" name="late" value="1" /> : null}
            <Button type="submit" size="sm" className="h-10 flex-1">Filter</Button>
            <Link href="/admin/orders" className="inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-brand hover:bg-brand-light">Reset</Link>
          </div>
        </form>
        {filters.late ? <p className="mt-3 text-xs text-muted">Showing orders past their delivery estimate.</p> : null}
      </Panel>

      <Panel>
        {orders.length === 0 ? (
          <EmptyState title="No orders match these filters." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Buyer</th>
                <th className={th}>Items</th>
                <th className={thNum}>Total</th>
                <th className={th}>Status</th>
                <th className={th}>City</th>
                <th className={th}>Placed</th>
                <th className={th}>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface">
                  <td className={td}>
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-brand hover:underline">#{shortId(order.id)}</Link>
                  </td>
                  <td className={td}>{order.buyer_name ?? "—"}</td>
                  <td className={td}>
                    <span className="tabular-nums">{order.item_count}</span>
                    {order.first_item_title ? <span className="block max-w-56 truncate text-xs text-muted">{order.first_item_title}</span> : null}
                  </td>
                  <td className={tdNum}>{formatPrice(order.total_amount)}</td>
                  <td className={td}><OrderStatusBadge status={order.status} /></td>
                  <td className={td}>{order.shipping_city ?? order.shipping_state ?? "—"}</td>
                  <td className={td}>{formatAdminDate(order.created_at)}</td>
                  <td className={td}>
                    {order.delivered_at
                      ? formatAdminDate(order.delivered_at)
                      : order.estimated_delivery ? <span className="text-muted">Est. {formatAdminDate(order.estimated_delivery)}</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {pageCount > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={pageHref(filters, page - 1)} className="font-medium text-brand hover:underline">← Newer</Link> : <span />}
            <span className="text-muted">Page {page} of {pageCount}</span>
            {page < pageCount ? <Link href={pageHref(filters, page + 1)} className="font-medium text-brand hover:underline">Older →</Link> : <span />}
          </nav>
        ) : null}
      </Panel>
    </>
  );
}
