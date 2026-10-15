"use client";

import { Download, Repeat, X } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, EmptyState, MomentRow, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import type { UpcomingMoment } from "@/lib/business-dashboard/types";
import { fromIsoDate, monthKey } from "@/lib/business-dashboard/utils";

function monthLabel(key: string) {
  return fromIsoDate(`${key}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Every moment in the next year, grouped by month. */
export function BizUpcoming() {
  const { moments, upcomingMonth, search, go, exportSchedule } = useBizDash();
  const query = search.trim().toLowerCase();

  const filtered = moments.filter(
    (moment) =>
      (!upcomingMonth || monthKey(moment.date) === upcomingMonth) &&
      (!query || `${moment.who} ${moment.sub} ${moment.label}`.toLowerCase().includes(query)),
  );

  const groups = new Map<string, UpcomingMoment[]>();
  for (const moment of filtered) {
    const key = monthKey(moment.date);
    groups.set(key, [...(groups.get(key) ?? []), moment]);
  }

  return (
    <>
      <ViewHeader
        title="Upcoming moments"
        description="Every birthday, work anniversary and campaign in the next twelve months."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => go("rules")}>
              <Repeat aria-hidden="true" className="h-4 w-4" /> Change automatic rules
            </Button>
            <Button variant="ink" size="sm" onClick={exportSchedule}>
              <Download aria-hidden="true" className="h-4 w-4" /> Export schedule (CSV)
            </Button>
          </>
        }
      />

      {upcomingMonth ? (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted">Showing</span>
          <button
            type="button"
            onClick={() => go("upcoming", { month: null })}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-sm font-medium text-brand hover:bg-brand-light/70"
          >
            {monthLabel(upcomingMonth)}
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">Show every month</span>
          </button>
        </div>
      ) : null}

      {groups.size ? (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([key, items]) => (
            <section key={key} aria-labelledby={`month-${key}`}>
              <h2 id={`month-${key}`} className="mb-2 flex items-baseline gap-2 px-1">
                <span className="text-base font-bold text-ink">{monthLabel(key)}</span>
                <span className="text-xs text-muted">
                  {items.length} {items.length === 1 ? "moment" : "moments"}
                </span>
              </h2>
              <Card>
                <ul className="divide-y divide-border">
                  {items.map((moment) => (
                    <MomentRow key={moment.id} moment={moment} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title={query || upcomingMonth ? "No moments match" : "Nothing coming up yet"}>
            {query || upcomingMonth
              ? "Try another search or month."
              : "Add your staff and clients and their days appear here automatically."}
          </EmptyState>
        </Card>
      )}
    </>
  );
}
