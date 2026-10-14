import type { Metadata } from "next";
import { BarList } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, StatTile, TabLinks, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getTopSharedWishlists, getWishlistMetrics } from "@/lib/admin/data/insights";
import { formatCount, formatPercent, humanize, parsePeriod, PERIOD_LABELS, PERIODS, periodSince } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Wishlists & Sharing" };

const two = (value: number | null) => (value == null ? "—" : value.toFixed(2));

export default async function WishlistsAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period);
  await requireAdminScreen("wishlists", { path: `/admin/wishlists?period=${period}` });
  const service = createServiceClient();
  const since = periodSince(period);
  const [metrics, top] = await Promise.all([getWishlistMetrics(service, since), getTopSharedWishlists(service, since)]);

  return (
    <>
      <AdminPageHeader
        title="Wishlists & Sharing"
        description="The viral loop: lists made, shared, opened, claimed, and the signups they bring."
        actions={<TabLinks label="Period" options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} active={period} hrefFor={(value) => `/admin/wishlists?period=${value}`} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Lists created" value={formatCount(metrics.lists_created)} />
        <StatTile label="Avg items per list" value={metrics.avg_items_per_list.toFixed(1)} />
        <StatTile label="Items with no price" value={formatCount(metrics.items_no_price)} hint={`of ${formatCount(metrics.items_total)} items`} />
        <StatTile label="Share rate" value={formatPercent(metrics.shareRate)} hint="Lists shared ÷ lists created" />
        <StatTile label="Opens per share" value={two(metrics.opensPerShare)} />
        <StatTile label="Claims per open" value={two(metrics.claimsPerOpen)} />
        <StatTile label="Signups from a list" value={formatCount(metrics.attributed_signups)} />
        <StatTile label="K-factor" value={two(metrics.kFactor)} hint="New accounts per list shared" />
        <StatTile label="Lists shared" value={formatCount(metrics.lists_shared)} hint={`${formatCount(metrics.shares)} shares`} />
        <StatTile label="Opens" value={formatCount(metrics.opens)} hint={`${formatCount(metrics.claims)} claims`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Where items come from" description="External items added before event tracking can't be split into scraped or typed in.">
          <BarList items={[
            { label: "Catalog", value: metrics.source.catalog },
            { label: "External · scraped link", value: metrics.source.external_scraped },
            { label: "External · entered by hand", value: metrics.source.external_manual },
            { label: "External · before tracking", value: metrics.source.external_untracked },
          ]} />
        </Panel>
        <Panel title="Most-shared wishlists" description="Receivers are shown as initials.">
          {top.length === 0 ? <EmptyState title="No shares recorded in this period." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Receiver</th>
                  <th className={th}>Occasion</th>
                  <th className={thNum}>Shares</th>
                  <th className={thNum}>Claims</th>
                  <th className={thNum}>Signups</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row) => (
                  <tr key={row.wishlist_id}>
                    <td className={`${td} font-semibold`}>{row.receiver}</td>
                    <td className={td}>{row.occasion ?? "Evergreen"}{row.occasion_type ? <span className="block text-xs text-muted">{humanize(row.occasion_type)}</span> : null}</td>
                    <td className={tdNum}>{row.shares}</td>
                    <td className={tdNum}>{row.claims}</td>
                    <td className={tdNum}>{row.attributed_signups}</td>
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
