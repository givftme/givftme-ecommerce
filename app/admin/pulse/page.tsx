import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleAlert, CircleCheck } from "lucide-react";
import { Sparkline } from "@/components/admin/AdminCharts";
import { AdminPageHeader, Delta, Panel, StatTile } from "@/components/admin/AdminUi";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getPulse } from "@/lib/admin/data/pulse";
import { formatCount } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Pulse" };

export default async function PulsePage() {
  await requireAdminScreen("pulse", { path: "/admin/pulse" });
  const pulse = await getPulse(createServiceClient());
  const ops = pulse.operations;

  return (
    <>
      <AdminPageHeader title="Pulse" description="Today against yesterday, with the last seven days. Days run on Lagos time." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {pulse.kpis.map((kpi) => {
          const format = kpi.money ? formatPrice : formatCount;
          return (
            <div key={kpi.key} className="min-w-0 rounded-2xl border border-line bg-card p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{kpi.label} today</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{format(kpi.today)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <Delta value={kpi.delta} format={(n) => format(n)} />
                <span>vs {format(kpi.yesterday)} yesterday</span>
              </div>
              <div className="mt-3">
                <Sparkline values={kpi.series} label={kpi.label} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Operations</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Gifts due today" value={formatCount(ops.due_today)} href="/admin/orders?status=confirmed" />
        <StatTile label="Out for delivery" value={formatCount(ops.out_for_delivery)} href="/admin/orders?status=shipped" />
        <StatTile label="Delivered today" value={formatCount(ops.delivered_today)} href="/admin/orders?status=delivered" />
        <StatTile label="Late" value={formatCount(ops.late)} tone={ops.late ? "alert" : "default"} hint="Past the delivery estimate" />
        <StatTile label="Failed deliveries" value={formatCount(ops.failed_deliveries)} tone={ops.failed_deliveries ? "alert" : "default"} hint="Cancelled after shipping, 7 days" href="/admin/orders?status=cancelled" />
      </div>

      <Panel title="Needs a human" description="Each row opens the screen where it gets resolved." className="mt-8">
        <ul className="divide-y divide-line">
          {pulse.needsHuman.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex min-h-12 items-center gap-3 rounded-lg py-2 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand">
                {item.count > 0
                  ? <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-danger" />
                  : <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-success" />}
                <span className="flex-1 text-sm text-ink">{item.label}</span>
                <span className={cn("min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-semibold tabular-nums", item.count > 0 ? "bg-brand-light text-danger" : "bg-surface text-muted")}>
                  {formatCount(item.count)}
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
