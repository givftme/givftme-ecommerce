import type { Metadata } from "next";
import { BarList } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, StatTile, TabLinks, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getDiaspora } from "@/lib/admin/data/insights";
import { formatCount, humanize, parsePeriod, PERIOD_LABELS, PERIODS, periodSince } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Diaspora" };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

export default async function DiasporaPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period, "all");
  await requireAdminScreen("diaspora", { path: `/admin/diaspora?period=${period}` });
  const data = await getDiaspora(createServiceClient(), periodSince(period));

  return (
    <>
      <AdminPageHeader
        title="Diaspora"
        description="Catalog orders from givers last seen outside Nigeria, by the country of their most recent visit."
        actions={<TabLinks label="Period" options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} active={period} hrefFor={(value) => `/admin/diaspora?period=${value}`} />}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Orders" value={formatCount(Number(data.totals.orders))} />
        <StatTile label="Value" value={formatPrice(Number(data.totals.value))} />
        <StatTile label="Givers" value={formatCount(Number(data.totals.givers))} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Source countries">
          {data.countries.length === 0 ? <EmptyState title="No orders from outside Nigeria yet.">Country comes from the giver&apos;s visits, so it fills in as people use the site.</EmptyState> : (
            <DataTable className="[&_table]:min-w-[420px]">
              <thead>
                <tr>
                  <th className={th}>Country</th>
                  <th className={thNum}>Orders</th>
                  <th className={thNum}>Givers</th>
                  <th className={thNum}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.countries.map((row) => (
                  <tr key={row.country}>
                    <td className={td}>{countryName(row.country)}</td>
                    <td className={tdNum}>{Number(row.orders)}</td>
                    <td className={tdNum}>{Number(row.givers)}</td>
                    <td className={tdNum}>{formatPrice(Number(row.value))}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Receivers in Nigeria" description="Where diaspora gifts are delivered.">
            <BarList items={data.receivers.map((row) => ({ label: row.area, value: Number(row.orders), sublabel: formatPrice(Number(row.value)) }))} empty="No deliveries yet." />
          </Panel>
          <Panel title="Occasions">
            <BarList items={data.occasions.map((row) => ({ label: humanize(row.occasion_type), value: Number(row.orders) }))} empty="No occasions yet." />
          </Panel>
        </div>
      </div>
    </>
  );
}
