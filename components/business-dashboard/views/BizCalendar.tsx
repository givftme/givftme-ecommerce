"use client";

import { ArrowRight } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { OccasionIcon, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { OCCASIONS } from "@/lib/business-dashboard/data";
import { fromIsoDate, monthKey } from "@/lib/business-dashboard/utils";

/** The next twelve months at a glance, and the occasions worth planning. */
export function BizCalendar() {
  const { moments, campaigns, today, go, can, openCampaign } = useBizDash();

  const months = Array.from({ length: 12 }, (_, index) => new Date(today.getFullYear(), today.getMonth() + index, 1));

  return (
    <>
      <ViewHeader
        title="Year calendar"
        description="Twelve months of birthdays, anniversaries and campaigns. Open a month to see who."
      />

      <ul className="grid grid-cols-2 gap-3 min-[1001px]:grid-cols-4 md:gap-4">
        {months.map((month) => {
          const key = monthKey(month);
          const inMonth = moments.filter((moment) => monthKey(moment.date) === key);
          const birthdays = inMonth.filter((moment) => moment.type === "birthday").length;
          const anniversaries = inMonth.filter((moment) => moment.type === "anniversary").length;
          const planned = campaigns.filter((campaign) => monthKey(fromIsoDate(campaign.delivery_date)) === key);

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => go("upcoming", { month: key })}
                className="flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="text-base font-bold text-ink">
                  {month.toLocaleDateString("en-GB", { month: "long" })}{" "}
                  <span className="font-medium text-muted">{month.getFullYear()}</span>
                </span>
                <span className="flex flex-col gap-1.5 text-xs text-ink">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand" />
                    {birthdays} {birthdays === 1 ? "birthday" : "birthdays"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-purple" />
                    {anniversaries} work {anniversaries === 1 ? "anniversary" : "anniversaries"}
                  </span>
                  {planned.length ? (
                    planned.map((campaign) => (
                      <span key={campaign.id} className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-green" />
                        <span className="truncate">{campaign.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="flex items-center gap-2 text-muted">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-line" />
                      No campaign planned
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="occasions-heading" className="mt-10">
        <h2 id="occasions-heading" className="mb-1 text-lg font-bold text-ink">Moments most companies plan for</h2>
        <p className="mb-4 text-sm text-muted">Pick one and we&apos;ll fill in the dates and headcount.</p>
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {OCCASIONS.map((occasion) => (
            <li key={occasion.key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <OccasionIcon occasion={occasion.key} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{occasion.key}</p>
                  <p className="text-xs text-muted">{occasion.note}</p>
                </div>
              </div>
              {can("edit_campaigns") ? (
                <Button variant="outline" size="sm" className="mt-auto w-fit" onClick={() => openCampaign({ occasion: occasion.key })}>
                  Plan this <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
