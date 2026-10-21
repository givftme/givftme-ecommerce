"use client";

import { ArrowRight, CalendarRange, CheckCircle2, Circle, Download, Headset, Palette, Sparkles, Upload } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, EmptyState, MomentRow, OccasionIcon, StatCard, StatGrid, ViewHeader } from "@/components/business-dashboard/BizUi";
import { BizProofTile } from "@/components/business-dashboard/views/BizProof";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { approveCampaign } from "@/lib/business-dashboard/actions";
import { campaignCost, formatLongDate, formatNaira, formatNairaK, fromIsoDate } from "@/lib/business-dashboard/utils";

interface SetupStep {
  label: string;
  detail: string;
  done: boolean;
  action: { label: string; onClick: () => void } | null;
}

/**
 * First-run guidance for a new account, worked out from the data already on
 * the page (no onboarding flag). Hidden once everything is done, or when
 * nothing left is something this member can do.
 */
function SetupChecklist() {
  const { account, staff, clients, campaigns, can, go, openCampaign } = useBizDash();

  const steps: SetupStep[] = [
    {
      label: "Add your people",
      detail: "Upload the staff list so birthdays and work anniversaries appear on their own.",
      done: staff.length + clients.length > 0,
      action: can("edit_people") ? { label: "Upload", onClick: () => go("import", { importKind: "staff" }) } : null,
    },
    {
      label: "Add your logo",
      detail: "It goes on every cake, box and card.",
      done: Boolean(account.logo_url),
      action: can("edit_brand") ? { label: "Brand kit", onClick: () => go("brand") } : null,
    },
    {
      label: "Set an annual budget",
      detail: "Track spend against it as campaigns are approved.",
      done: account.annual_budget > 0,
      action: can("view_budget") && can("approve_campaigns") ? { label: "Budget", onClick: () => go("budget") } : null,
    },
    {
      label: "Plan your first campaign",
      detail: "A birthday, Customer Service Week or end-of-year gift.",
      done: campaigns.length > 0,
      action: can("edit_campaigns") ? { label: "New campaign", onClick: () => openCampaign() } : null,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (!steps.some((step) => !step.done && step.action)) return null;

  return (
    <Card title="Get set up" description={`${doneCount} of ${steps.length} done`} className="mt-4 md:mt-6">
      <ol className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {step.done ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <Circle aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className={step.done ? "text-sm font-semibold text-muted line-through" : "text-sm font-semibold text-ink"}>
                {step.label}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </p>
              {step.done ? null : <p className="text-xs text-muted">{step.detail}</p>}
            </div>
            {!step.done && step.action ? (
              <Button variant="text" size="sm" onClick={step.action.onClick}>
                {step.action.label} <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Stats, setup checklist, next 30 days, proof of delivery, approvals and quick actions. */
export function BizOverview() {
  const {
    account,
    member,
    moments,
    staff,
    clients,
    campaigns,
    deliveries,
    can,
    go,
    run,
    openCampaign,
    openBrief,
    exportSchedule,
  } = useBizDash();

  const next30 = moments.filter((moment) => moment.days <= 30);
  const pending = campaigns.filter((campaign) => campaign.status === "Pending approval");
  const proof = deliveries.filter((delivery) => delivery.status === "delivered").slice(0, 3);
  const budgetPct = account.annual_budget > 0 ? Math.round((account.budget_used / account.annual_budget) * 100) : null;
  const firstName = member.full_name.split(" ")[0];

  return (
    <>
      <ViewHeader
        title={`Hello, ${firstName}`}
        description={`Here's what's coming up for ${account.company_name}.`}
      />

      <StatGrid>
        <StatCard label="Moments in the next 30 days" value={next30.length} hint="Birthdays, anniversaries and campaigns" />
        <StatCard
          label="People on file"
          value={staff.length + clients.length}
          hint={`${staff.length} staff · ${clients.length} clients`}
        />
        {can("view_budget") ? (
          <StatCard
            label="Budget used"
            value={budgetPct === null ? "—" : `${budgetPct}%`}
            hint={
              budgetPct === null
                ? "No annual budget set"
                : `${formatNairaK(account.budget_used)} of ${formatNairaK(account.annual_budget)}`
            }
          />
        ) : (
          <StatCard label="Budget used" value="—" hint="Visible to Finance and HR" />
        )}
        <StatCard
          label="Waiting for approval"
          value={pending.length}
          hint={pending.length ? "Campaigns pending" : "All clear"}
          pill={pending.length > 0 ? <Badge variant="warning">Needs approval</Badge> : null}
        />
      </StatGrid>

      <SetupChecklist />

      <div className="mt-4 grid gap-4 md:mt-6 md:gap-6 min-[1001px]:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card
            title="Next 30 days"
            actions={
              <Button variant="text" size="sm" onClick={() => go("upcoming")}>
                See all <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            }
          >
            {next30.length ? (
              <ul className="divide-y divide-border">
                {next30.slice(0, 7).map((moment) => (
                  <MomentRow key={moment.id} moment={moment} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing in the next 30 days"
                action={
                  can("edit_people") ? (
                    <Button variant="outline" size="sm" onClick={() => go("import", { importKind: "staff" })}>
                      Upload the staff list
                    </Button>
                  ) : null
                }
              >
                Upload your staff list and every birthday and work anniversary shows up here.
              </EmptyState>
            )}
          </Card>

          <Card
            title="Proof of delivery"
            actions={
              <Button variant="text" size="sm" onClick={() => go("proof")}>
                All deliveries <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            }
          >
            {proof.length ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {proof.map((delivery) => (
                  <BizProofTile key={delivery.id} delivery={delivery} compact />
                ))}
              </ul>
            ) : (
              <EmptyState title="No deliveries yet">A photo of every delivered gift lands here.</EmptyState>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Needs your attention">
            {pending.length ? (
              <ul className="divide-y divide-border">
                {pending.map((campaign) => (
                  <li key={campaign.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <OccasionIcon occasion={campaign.occasion} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{campaign.name}</p>
                      <p className="truncate text-xs text-muted">
                        {formatNaira(campaignCost(campaign))} · {formatLongDate(fromIsoDate(campaign.delivery_date))}
                      </p>
                    </div>
                    {can("approve_campaigns") ? (
                      <Button
                        size="sm"
                        onClick={() => run(() => approveCampaign(account.id, campaign.id), "Campaign approved")}
                      >
                        Approve
                      </Button>
                    ) : (
                      <Badge variant="warning">With Finance</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing waiting.</p>
            )}
          </Card>

          <Card title="Quick actions" bodyClassName="grid gap-2">
            {can("edit_people") ? (
              <Button variant="ghost" className="justify-start" onClick={() => go("import", { importKind: "staff" })}>
                <Upload aria-hidden="true" className="h-4 w-4" /> Upload the staff list
              </Button>
            ) : null}
            {can("edit_campaigns") ? (
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => openCampaign({ occasion: "Customer Service Week", audience: "Everyone", heads: staff.length || undefined })}
              >
                <Headset aria-hidden="true" className="h-4 w-4" /> Plan Customer Service Week
              </Button>
            ) : null}
            <Button variant="ghost" className="justify-start" onClick={() => go("brand")}>
              <Palette aria-hidden="true" className="h-4 w-4" /> Update brand kit
            </Button>
            <Button variant="ghost" className="justify-start" onClick={exportSchedule}>
              <Download aria-hidden="true" className="h-4 w-4" /> Export year schedule
            </Button>
          </Card>

          <section className="rounded-2xl bg-ink p-6 text-background">
            <Sparkles aria-hidden="true" className="h-6 w-6 text-brand" />
            <h2 className="mt-3 text-lg font-bold">Planning something bigger?</h2>
            <p className="mt-1 text-sm opacity-75">
              Launches, retreats, end-of-year gifting for every office. Tell the Experience Centre and we&apos;ll build it with you.
            </p>
            <Button className="mt-4" onClick={() => openBrief()}>
              <CalendarRange aria-hidden="true" className="h-4 w-4" /> Send a brief
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
