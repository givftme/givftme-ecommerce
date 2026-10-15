import type { Metadata } from "next";
import Link from "next/link";
import { BarList, ColumnChart, Donut } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getCalendar } from "@/lib/admin/data/insights";
import { formatPercent, humanize, ratio } from "@/lib/admin/format";
import { OCCASION_LABELS, OCCASION_TYPES } from "@/lib/occasion/constants";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar Engine" };

const occasionLabel = (type: string) => OCCASION_LABELS[type as keyof typeof OCCASION_LABELS] ?? humanize(type);

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
}

/** The last twelve months, oldest first, as YYYY-MM. */
function lastTwelveMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export default async function CalendarPage() {
  await requireAdminScreen("calendar", { path: "/admin/calendar" });
  const data = await getCalendar(createServiceClient());
  const months = lastTwelveMonths();

  const byMonth = months.map((month) => ({
    label: monthLabel(month),
    values: Object.fromEntries(
      data.dates_by_month.filter((row) => row.month === month).map((row) => [row.occasion_type, Number(row.count)]),
    ),
  }));
  const missed = new Map(data.missed_by_month.map((row) => [row.month, row]));

  return (
    <>
      <AdminPageHeader title="Calendar Engine" description="How people save dates, how reminders perform, and how far ahead orders are planned." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Dates saved by month" description="By occasion type, last 12 months.">
          <ColumnChart
            data={byMonth}
            series={OCCASION_TYPES.map((type) => ({ key: type, label: OCCASION_LABELS[type] }))}
            empty="No dates saved in the last year."
          />
        </Panel>
        <Panel title="Occasion mix" description="Every saved date.">
          <Donut
            keys={OCCASION_TYPES}
            items={data.occasion_mix.map((row) => ({ key: row.occasion_type, label: occasionLabel(row.occasion_type), value: Number(row.count) }))}
            empty="No dates saved yet."
          />
        </Panel>
      </div>

      <Panel title="Reminder performance" description="Opens come from the email image pixel, so mail apps that preload images can overstate them. Actioned = an order or claim within 48 hours." className="mt-6">
        {data.reminders.length === 0 ? <EmptyState title="No reminders sent since tracking began." /> : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Channel</th>
                <th className={thNum}>Days before</th>
                <th className={thNum}>Sent</th>
                <th className={thNum}>Opened</th>
                <th className={thNum}>Actioned</th>
                <th className={thNum}>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {data.reminders.map((row) => (
                <tr key={`${row.channel}-${row.days_before}`}>
                  <td className={td}>{humanize(row.channel)}</td>
                  <td className={tdNum}>{row.days_before ?? "—"}</td>
                  <td className={tdNum}>{Number(row.sent).toLocaleString("en-NG")}</td>
                  <td className={tdNum}>{Number(row.opened).toLocaleString("en-NG")}</td>
                  <td className={tdNum}>{Number(row.actioned).toLocaleString("en-NG")}</td>
                  <td className={tdNum}>{formatPercent(ratio(Number(row.actioned), Number(row.sent)))}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Lead time" description="Days between an order and the occasion it was for.">
          <ColumnChart
            data={data.lead_time.map((row) => ({ label: row.bucket, values: { orders: Number(row.orders) } }))}
            series={[{ key: "orders", label: "Orders" }]}
            height={120}
            empty="No orders since tracking began."
          />
        </Panel>
        <Panel title="Missed dates" description="Occasions that passed with nothing gifted, and how many were recovered by a late order.">
          {data.missed_by_month.length === 0 ? <EmptyState title="No missed dates recorded." /> : (
            <DataTable className="[&_table]:min-w-0">
              <thead>
                <tr>
                  <th className={th}>Month</th>
                  <th className={thNum}>Missed</th>
                  <th className={thNum}>Recovered</th>
                  <th className={thNum}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {months.filter((month) => missed.has(month)).map((month) => {
                  const row = missed.get(month)!;
                  return (
                    <tr key={month}>
                      <td className={td}>{monthLabel(month)}</td>
                      <td className={tdNum}>{Number(row.missed)}</td>
                      <td className={tdNum}>{Number(row.recovered)}</td>
                      <td className={tdNum}>{formatPercent(ratio(Number(row.recovered), Number(row.missed)), 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </Panel>
        <Panel title="Streak leaderboard" description="Months since first saving a date, or since the last missed one.">
          <BarList
            items={data.streaks.map((row) => ({ label: row.name || "Unnamed", value: row.months, display: `${row.months} mo` }))}
            empty="No streaks yet."
          />
          {data.streaks.length ? (
            <p className="mt-3 text-xs text-muted">
              Open someone from <Link href="/admin/people" className="text-brand hover:underline">People</Link> to see their calendar.
            </p>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
