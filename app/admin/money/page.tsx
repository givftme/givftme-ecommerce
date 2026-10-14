import type { Metadata } from "next";
import Link from "next/link";
import { ColumnChart } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, StatTile, TabLinks, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getMoney } from "@/lib/admin/data/insights";
import { formatAdminDate, formatCount, parsePeriod, PERIOD_LABELS, PERIODS, periodSince, shortId } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period);
  await requireAdminScreen("money", { path: `/admin/money?period=${period}` });
  const money = await getMoney(createServiceClient(), periodSince(period));

  // Weekly points keep the 90-day trend readable; each is a 30-day rolling average.
  const trend = money.aov_trend.filter((_, index, all) => (all.length - 1 - index) % 7 === 0);
  const gross = Number(money.catalog.gross);

  return (
    <>
      <AdminPageHeader
        title="Money"
        description="Naira only. Revenue counts orders from the moment payment was captured."
        actions={<TabLinks label="Period" options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} active={period} hrefFor={(value) => `/admin/money?period=${value}`} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Catalog orders" value={formatPrice(gross)} hint={`${formatCount(Number(money.catalog.orders))} paid orders`} />
        <StatTile label="Refunded" value={formatPrice(Number(money.refunded_total))} hint={`Net ${formatPrice(gross - Number(money.refunded_total))}`} />
        <StatTile label="Gift cards" value="—" hint="Not live: no gift card sales recorded" />
        <StatTile label="Business plans" value="—" hint="Not live: plans are sold offline" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Pool contributions in this period: {formatPrice(Number(money.pool_funds))}. These are held for receivers, not revenue.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Average order value" description="30-day rolling average, shown weekly over the last 90 days.">
          <ColumnChart
            data={trend.map((point) => ({ label: formatAdminDate(point.day).replace(/ \d{4}$/, ""), values: { aov: Number(point.aov ?? 0) } }))}
            series={[{ key: "aov", label: "Average order value" }]}
            format={(value) => formatPrice(value)}
            height={140}
            empty="No paid orders in the last 90 days."
          />
        </Panel>
        <Panel title="Planner's Rate" description="How far ahead of the occasion orders were placed.">
          <ColumnChart
            data={money.planners_rate.map((row) => ({ label: row.bucket, values: { orders: row.orders } }))}
            series={[{ key: "orders", label: "Orders" }]}
            height={140}
            empty="No orders since tracking began."
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Gift cards" description="Issued, redeemed, and outstanding liability.">
          <EmptyState title="Gift cards aren't sold through the app yet.">This panel fills in once gift card issuance is recorded.</EmptyState>
        </Panel>
        <Panel title="Refunds" description="Approved by the team member who moved the order to refunded.">
          {money.refunds.length === 0 ? <EmptyState title="No refunds in this period." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={thNum}>Amount</th>
                  <th className={th}>Reason</th>
                  <th className={th}>Approved by</th>
                  <th className={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {money.refunds.map((refund) => (
                  <tr key={refund.order_id}>
                    <td className={td}><Link href={`/admin/orders/${refund.order_id}`} className="font-semibold text-brand hover:underline">#{shortId(refund.order_id)}</Link></td>
                    <td className={tdNum}>{formatPrice(Number(refund.amount))}</td>
                    <td className={td}>{refund.reason ?? "—"}</td>
                    <td className={td}>{refund.approved_by ?? "Outside the dashboard"}</td>
                    <td className={td}>{formatAdminDate(refund.refunded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
