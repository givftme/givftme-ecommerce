"use client";

import { useState } from "react";
import { CalendarDays, Gift, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, DaysChip, EmptyState, OccasionIcon, StatusPill, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { approveCampaign, deleteCampaign, sendForApproval } from "@/lib/business-dashboard/actions";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/lib/business-dashboard/data";
import type { BusinessCampaign } from "@/lib/business-dashboard/types";
import { campaignCost, daysTo, formatLongDate, formatNaira, fromIsoDate } from "@/lib/business-dashboard/utils";
import { cn } from "@/lib/utils";

type Filter = CampaignStatus | "All";
const FILTERS: Filter[] = ["All", ...CAMPAIGN_STATUSES];

/** Campaigns grid with status filter tabs. */
export function BizCampaigns() {
  const { campaigns, campaignStatus, search, can, openCampaign } = useBizDash();
  const [filter, setFilter] = useState<Filter>(campaignStatus);
  const query = search.trim().toLowerCase();

  const visible = campaigns.filter(
    (campaign) =>
      (filter === "All" || campaign.status === filter) &&
      (!query || `${campaign.name} ${campaign.occasion} ${campaign.audience} ${campaign.gift_type}`.toLowerCase().includes(query)),
  );

  return (
    <>
      <ViewHeader
        title="Campaigns"
        description="Plan it, send it to Finance, and we'll handle the rest."
        actions={
          can("edit_campaigns") ? (
            <Button size="sm" onClick={() => openCampaign()}>
              <Plus aria-hidden="true" className="h-4 w-4" /> New campaign
            </Button>
          ) : null
        }
      />

      <div role="tablist" aria-label="Campaign status" className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-card p-1 ring-1 ring-border sm:w-fit">
        {FILTERS.map((option) => {
          const count = option === "All" ? campaigns.length : campaigns.filter((campaign) => campaign.status === option).length;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                filter === option ? "bg-ink text-background" : "text-muted hover:text-ink",
              )}
            >
              {option} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
          {visible.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title={campaigns.length ? "No campaigns match" : "No campaigns yet"}
            action={
              !campaigns.length && can("edit_campaigns") ? (
                <Button size="sm" onClick={() => openCampaign()}>
                  <Plus aria-hidden="true" className="h-4 w-4" /> Plan your first campaign
                </Button>
              ) : null
            }
          >
            {campaigns.length ? "Try another status or search." : "Customer Service Week, end of year, Mother's Day — start one in a minute."}
          </EmptyState>
        </Card>
      )}
    </>
  );
}

function CampaignCard({ campaign }: { campaign: BusinessCampaign }) {
  const { account, today, can, run, openCampaign, openBrief } = useBizDash();
  const [busy, setBusy] = useState(false);
  const date = fromIsoDate(campaign.delivery_date);
  const days = daysTo(date, today);
  const total = campaignCost(campaign);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 p-5 pb-4">
        <OccasionIcon occasion={campaign.occasion} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-ink">{campaign.name}</h2>
          <p className="truncate text-xs text-muted">{campaign.audience}</p>
        </div>
        <StatusPill status={campaign.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-5 py-4 text-sm">
        <div className="col-span-2 flex items-center gap-2">
          <dt className="sr-only">Delivery date</dt>
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-muted" />
          <dd className="text-ink">{formatLongDate(date)}</dd>
          {days >= 0 ? <DaysChip days={days} /> : <span className="text-xs text-muted">Past</span>}
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">People</dt>
          <Users aria-hidden="true" className="h-4 w-4 text-muted" />
          <dd className="text-ink">{campaign.heads} {campaign.heads === 1 ? "person" : "people"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Gift</dt>
          <Gift aria-hidden="true" className="h-4 w-4 text-muted" />
          <dd className="truncate text-ink">{campaign.gift_type}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Per person</dt>
          <dd className="text-ink">
            {formatNaira(campaign.per_head)} <span className="text-xs text-muted">+ {formatNaira(campaign.delivery_fee)} delivery</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Estimated total</dt>
          <dd className="text-lg font-bold tabular-nums text-ink">{formatNaira(total)}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {campaign.status === "Draft" && can("edit_campaigns") ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              act(() =>
                run(
                  () => sendForApproval(account.id, campaign.id),
                  (data) => (data.status === "Approved" ? "Approved automatically — under your auto-approve amount" : "Sent for approval"),
                ),
              )
            }
          >
            Send for approval
          </Button>
        ) : null}
        {campaign.status === "Pending approval" && can("approve_campaigns") ? (
          <Button size="sm" disabled={busy} onClick={() => act(() => run(() => approveCampaign(account.id, campaign.id), "Campaign approved"))}>
            Approve
          </Button>
        ) : null}
        {campaign.status === "Approved" || campaign.status === "Delivered" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openBrief({
                occasion: campaign.occasion,
                heads: campaign.heads,
                neededBy: campaign.delivery_date,
                notes: `Campaign "${campaign.name}": ${campaign.heads} × ${campaign.gift_type} at ${formatNaira(campaign.per_head)} each for ${campaign.audience}.${campaign.card_message ? ` Card message: "${campaign.card_message}"` : ""}`,
              })
            }
          >
            <Send aria-hidden="true" className="h-4 w-4" /> Send to Experience Centre
          </Button>
        ) : null}

        {can("edit_campaigns") ? (
          <div className="ml-auto flex items-center gap-1">
            {campaign.status !== "Delivered" ? (
              <Button variant="text" size="sm" onClick={() => openCampaign({ campaign })}>
                <Pencil aria-hidden="true" className="h-4 w-4" /> Edit
              </Button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              aria-label={`Delete ${campaign.name}`}
              onClick={() => {
                if (!window.confirm(`Delete "${campaign.name}"?`)) return;
                void act(() => run(() => deleteCampaign(account.id, campaign.id), "Campaign deleted"));
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-brand-light hover:text-danger disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
