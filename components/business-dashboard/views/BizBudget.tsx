"use client";

import { useState } from "react";
import { AlertTriangle, Download, Loader2, Pencil } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, EmptyState, Field, StatCard, StatGrid, StatusPill, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateBudget } from "@/lib/business-dashboard/actions";
import type { BusinessCampaign } from "@/lib/business-dashboard/types";
import {
  campaignCost,
  downloadText,
  formatLongDate,
  formatNaira,
  formatNairaK,
  fromIsoDate,
  monthKey,
  toCsv,
} from "@/lib/business-dashboard/utils";

const WARN_AT = 0.85;

interface Invoice {
  key: string;
  label: string;
  campaigns: BusinessCampaign[];
  total: number;
  billable: boolean;
}

/**
 * One invoice per delivery month, covering every approved or delivered
 * campaign in it ("One invoice, every gift and every office"). There is no
 * payment record yet, so a month is "Due" once something in it has been
 * delivered and "Upcoming" before that.
 */
function monthlyInvoices(campaigns: BusinessCampaign[]): Invoice[] {
  const groups = new Map<string, BusinessCampaign[]>();
  for (const campaign of campaigns) {
    if (campaign.status !== "Approved" && campaign.status !== "Delivered") continue;
    const key = monthKey(fromIsoDate(campaign.delivery_date));
    groups.set(key, [...(groups.get(key) ?? []), campaign]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: fromIsoDate(`${key}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      campaigns: items,
      total: items.reduce((sum, campaign) => sum + campaignCost(campaign), 0),
      billable: items.some((campaign) => campaign.status === "Delivered"),
    }));
}

export function BizBudget() {
  const { account, campaigns, people, can, run } = useBizDash();
  const [editing, setEditing] = useState(false);
  const [annual, setAnnual] = useState(String(account.annual_budget || ""));
  const [spent, setSpent] = useState(String(account.budget_used || ""));
  const [saving, setSaving] = useState(false);

  if (!can("view_budget")) {
    return (
      <>
        <ViewHeader title="Budget & invoices" />
        <Card>
          <EmptyState title="You don't have permission to do that.">Budgets are visible to admins, editors and approvers.</EmptyState>
        </Card>
      </>
    );
  }

  const budget = account.annual_budget;
  const used = account.budget_used;
  const committed = campaigns
    .filter((campaign) => campaign.status === "Approved")
    .reduce((sum, campaign) => sum + campaignCost(campaign), 0);
  const spentPct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
  const committedPct = budget > 0 ? Math.min(100 - spentPct, (committed / budget) * 100) : 0;
  const overWarning = budget > 0 && (used + committed) / budget > WARN_AT;
  const perPerson = people.length ? budget / people.length : 0;
  const costed = campaigns.filter((campaign) => campaign.status !== "Draft");
  const invoices = monthlyInvoices(campaigns);

  const save = async () => {
    setSaving(true);
    const result = await run(() => updateBudget(account.id, Number(spent) || 0, Number(annual) || 0), "Budget updated");
    setSaving(false);
    if (result.ok) setEditing(false);
  };

  const downloadInvoice = (invoice: Invoice) =>
    downloadText(
      `givftme-invoice-${invoice.key}.csv`,
      toCsv([
        ["Campaign", "Delivery date", "People", "Per person", "Delivery fee", "Total", "Status"],
        ...invoice.campaigns.map((campaign) => [
          campaign.name,
          campaign.delivery_date,
          campaign.heads,
          campaign.per_head,
          campaign.delivery_fee,
          campaignCost(campaign),
          campaign.status,
        ]),
        ["Total", "", "", "", "", invoice.total, ""],
      ]),
    );

  return (
    <>
      <ViewHeader
        title="Budget & invoices"
        description={`${account.plan} plan · ${formatNaira(account.delivery_fee)} delivery per gift`}
        actions={
          can("approve_campaigns") && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="h-4 w-4" /> Update budget
            </Button>
          ) : null
        }
      />

      {editing ? (
        <Card className="mb-4 md:mb-6">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Approved annual budget (₦)" htmlFor="budget-annual">
              <Input id="budget-annual" type="number" min={0} step={10000} inputMode="numeric" value={annual} onChange={(event) => setAnnual(event.target.value)} className="h-11" />
            </Field>
            <Field label="Spent so far (₦)" htmlFor="budget-spent">
              <Input id="budget-spent" type="number" min={0} step={1000} inputMode="numeric" value={spent} onChange={(event) => setSpent(event.target.value)} className="h-11" />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <StatGrid>
        <StatCard label="Approved budget" value={budget ? formatNairaK(budget) : "—"} hint={budget ? formatNaira(budget) : "Not set yet"} />
        <StatCard label="Spent so far" value={formatNairaK(used)} hint={budget ? `${Math.round((used / budget) * 100)}% of budget` : formatNaira(used)} />
        <StatCard label="Committed" value={formatNairaK(committed)} hint="Approved, not yet delivered" />
        <StatCard label="Per person per year" value={perPerson ? formatNairaK(perPerson) : "—"} hint={`${people.length} people on file`} />
      </StatGrid>

      <Card className="mt-4 md:mt-6" title="Where the budget is">
        {budget > 0 ? (
          <>
            <div
              role="img"
              aria-label={`${Math.round(spentPct)}% spent and ${Math.round(committedPct)}% committed of ${formatNaira(budget)}`}
              className="flex h-4 overflow-hidden rounded-full bg-surface"
            >
              <span className="h-full bg-brand" style={{ width: `${spentPct}%` }} />
              <span className="h-full bg-brand/35" style={{ width: `${committedPct}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand" /> Spent {formatNaira(used)}</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand/35" /> Committed {formatNaira(committed)}</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-surface ring-1 ring-border" /> Left {formatNaira(Math.max(0, budget - used - committed))}</span>
            </div>
            {overWarning ? (
              <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber/10 dark:text-amber">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Over 85% of the budget is spent or committed. Check with Finance before approving more.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Set the approved annual budget to track spend against it.</p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:mt-6 md:gap-6 min-[1001px]:grid-cols-[1.4fr_1fr]">
        <Card title="Campaign costs" bodyClassName="p-0">
          {costed.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border">
                    <th scope="col" className="px-5 py-3 font-medium">Campaign</th>
                    <th scope="col" className="px-3 py-3 font-medium">Date</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">People</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Per person</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {costed.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-5 py-3 font-semibold text-ink">{campaign.name}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatLongDate(fromIsoDate(campaign.delivery_date))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{campaign.heads}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNaira(campaign.per_head + campaign.delivery_fee)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNaira(campaignCost(campaign))}</td>
                      <td className="px-5 py-3"><StatusPill status={campaign.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No costed campaigns yet">Drafts appear here once they&apos;re sent for approval.</EmptyState>
          )}
        </Card>

        <Card title="Invoices" bodyClassName="p-0">
          {invoices.length ? (
            <ul className="divide-y divide-border">
              {invoices.map((invoice) => (
                <li key={invoice.key} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      Invoice · {invoice.label} <span className="font-normal text-muted">{formatNaira(invoice.total)}</span>
                    </p>
                    <p className="text-xs text-muted">One invoice, every gift and every office</p>
                  </div>
                  <Badge variant={invoice.billable ? "warning" : "muted"}>{invoice.billable ? "Due" : "Upcoming"}</Badge>
                  <Button variant="text" size="sm" onClick={() => downloadInvoice(invoice)} aria-label={`Download invoice for ${invoice.label}`}>
                    <Download aria-hidden="true" className="h-4 w-4" />
                    <span className="max-sm:sr-only">Download</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No invoices yet">Approved campaigns are billed together once a month.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
