import type { Metadata } from "next";
import { BarList } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, fieldLabel, Panel, selectClass, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getDemand } from "@/lib/admin/data/insights";
import { formatPercent, humanize, parsePeriod, PERIOD_LABELS, PERIODS, periodSince, ratio } from "@/lib/admin/format";
import { OCCASION_LABELS, OCCASION_TYPES } from "@/lib/occasion/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Demand Intelligence" };

const OCCASION_FILTERS = ["evergreen", ...OCCASION_TYPES] as const;

export default async function DemandPage({ searchParams }: { searchParams: Promise<{ period?: string; occasion?: string }> }) {
  const params = await searchParams;
  const period = parsePeriod(params.period, "90d");
  const occasion = (OCCASION_FILTERS as readonly string[]).includes(params.occasion || "") ? params.occasion! : null;
  await requireAdminScreen("demand", { path: "/admin/demand" });
  const data = await getDemand(createServiceClient(), periodSince(period), occasion);

  return (
    <>
      <AdminPageHeader title="Demand Intelligence" description="What people wish for and search for, and what we don't stock yet." />

      <Panel className="mb-6">
        <form action="/admin/demand" className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label htmlFor="period" className={fieldLabel}>Period</label>
            <select id="period" name="period" defaultValue={period} className={selectClass}>
              {PERIODS.map((value) => <option key={value} value={value}>{PERIOD_LABELS[value]}</option>)}
            </select>
          </div>
          <div className="w-48">
            <label htmlFor="occasion" className={fieldLabel}>Occasion</label>
            <select id="occasion" name="occasion" defaultValue={occasion ?? ""} className={selectClass}>
              <option value="">All occasions</option>
              {OCCASION_FILTERS.map((value) => (
                <option key={value} value={value}>{value === "evergreen" ? "Evergreen list" : OCCASION_LABELS[value as keyof typeof OCCASION_LABELS]}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" className="h-10">Apply</Button>
        </form>
      </Panel>

      <Panel title="Most wished-for items" description="Grouped by title. The occasion and city filters apply to wishlist items.">
        {data.top_items.length === 0 ? <EmptyState title="No wishlist items in this period." /> : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Item</th>
                <th className={thNum}>Wishes</th>
                <th className={thNum}>Avg price</th>
                <th className={th}>Top occasion</th>
                <th className={th}>Top city</th>
              </tr>
            </thead>
            <tbody>
              {data.top_items.map((item) => (
                <tr key={item.title}>
                  <td className={td}>{item.title}</td>
                  <td className={tdNum}>{Number(item.wishes)}</td>
                  <td className={tdNum}>{item.avg_price == null ? "—" : formatPrice(Number(item.avg_price))}</td>
                  <td className={td}>{humanize(item.top_occasion)}</td>
                  <td className={td}>{item.top_city ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Most searched terms">
          {data.searches.length === 0 ? <EmptyState title="No searches in this period." /> : (
            <DataTable className="[&_table]:min-w-[420px]">
              <thead>
                <tr>
                  <th className={th}>Search</th>
                  <th className={thNum}>Searches</th>
                  <th className={thNum}>Found results</th>
                  <th className={thNum}>Nothing found</th>
                </tr>
              </thead>
              <tbody>
                {data.searches.map((row) => (
                  <tr key={row.query}>
                    <td className={td}>{row.query}</td>
                    <td className={tdNum}>{Number(row.searches)}</td>
                    <td className={tdNum}>{formatPercent(ratio(Number(row.with_results), Number(row.searches)), 0)}</td>
                    <td className={tdNum}>{formatPercent(ratio(Number(row.zero_results), Number(row.searches)), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>
        <Panel title="Zero-result searches" description="The shopping list: what people looked for and didn't find.">
          <BarList items={data.zero_results.map((row) => ({ label: row.query, value: Number(row.searches) }))} empty="Every search found something." />
        </Panel>
        <Panel title="Pasted link domains" description="Where external wishlist items come from.">
          <BarList items={data.domains.map((row) => ({ label: row.domain, value: Number(row.items) }))} empty="No external links in this period." />
        </Panel>
        <Panel title="Wanted vs bought" description="By catalog category, for items added since tracking began.">
          {data.gap.length === 0 ? <EmptyState title="No tracked items yet." /> : (
            <DataTable className="[&_table]:min-w-[420px]">
              <thead>
                <tr>
                  <th className={th}>Category</th>
                  <th className={thNum}>Wished</th>
                  <th className={thNum}>Bought</th>
                  <th className={thNum}>Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.gap.map((row) => (
                  <tr key={row.category}>
                    <td className={td}>{row.category}</td>
                    <td className={tdNum}>{Number(row.wanted)}</td>
                    <td className={tdNum}>{Number(row.bought)}</td>
                    <td className={tdNum}>{Number(row.wanted) - Number(row.bought)}</td>
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
