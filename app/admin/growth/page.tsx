import type { Metadata } from "next";
import { Funnel, heatStyle } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { SegmentCard } from "@/components/admin/SegmentCard";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getCohorts, getFunnel, getSegmentCounts } from "@/lib/admin/data/growth";
import { formatAdminDate, formatPercent } from "@/lib/admin/format";
import { SEGMENTS } from "@/lib/admin/segments";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Growth & Cohorts" };

const RETENTION_DAYS = ["d7", "d14", "d30", "d60", "d90"] as const;

export default async function GrowthPage() {
  await requireAdminScreen("growth", { path: "/admin/growth" });
  const service = createServiceClient();
  const [funnel, cohorts, counts] = await Promise.all([getFunnel(service), getCohorts(service, 12), getSegmentCounts(service)]);
  const refreshedAt = new Date().toISOString();

  return (
    <>
      <AdminPageHeader title="Growth & Cohorts" description="Activation and retention from the event log. Events are recorded from the date this dashboard launched." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Activation funnel" description="People who reached each step. Red is the share lost from the step before.">
          <Funnel steps={funnel} />
        </Panel>

        <Panel title="Cohort retention" description="Share of each signup week active in the week starting day 7, 14, 30, 60, and 90. Darker green is better.">
          {cohorts.length === 0 ? <EmptyState title="No signups in the last 12 weeks." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Week of</th>
                  <th className={thNum}>People</th>
                  {RETENTION_DAYS.map((day) => <th key={day} className={thNum}>Day {day.slice(1)}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.cohort_week}>
                    <td className={td}>{formatAdminDate(cohort.cohort_week)}</td>
                    <td className={tdNum}>{cohort.cohort_size.toLocaleString("en-NG")}</td>
                    {RETENTION_DAYS.map((day) => (
                      <td key={day} className={`${tdNum} rounded-sm`} style={heatStyle(cohort[day])} title={cohort[day] == null ? "Not reached yet" : undefined}>
                        {cohort[day] == null ? <span className="text-muted">·</span> : formatPercent(cohort[day], 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Lifecycle segments</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SEGMENTS.map((segment) => (
          <SegmentCard
            key={segment.id}
            id={segment.id}
            name={segment.name}
            definition={segment.definition}
            count={counts[segment.id]}
            refreshedAt={refreshedAt}
            showPreview={false}
          />
        ))}
      </div>
    </>
  );
}
