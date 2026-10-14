import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { AdminPageHeader, DataTable, EmptyState, Panel, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { isUuid, requireAdminScreen } from "@/lib/admin/auth";
import { getCorporateHistory, listCorporateAccounts, type AccountHealth } from "@/lib/admin/data/corporate";
import { formatAdminDate, formatAdminDateTime, humanize, shortId } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Corporate" };

const HEALTH: Record<AccountHealth, { label: string; Icon: typeof CircleCheck; className: string }> = {
  healthy: { label: "Healthy", Icon: CircleCheck, className: "text-success" },
  drifting: { label: "Drifting", Icon: CircleDashed, className: "text-warning" },
  "at-risk": { label: "At risk", Icon: CircleAlert, className: "text-danger" },
};

export default async function CorporatePage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const company = (await searchParams).company;
  const selectedId = company && isUuid(company) ? company : null;
  await requireAdminScreen("corporate", {
    path: "/admin/corporate",
    ...(selectedId ? { action: "view_company", targetType: "business_enquiry", targetId: selectedId } : {}),
  });
  const service = createServiceClient();
  const { accounts, orders } = await listCorporateAccounts(service);
  const selected = accounts.find((account) => account.enquiry_id === selectedId) ?? null;
  const history = selected ? await getCorporateHistory(service, selected.enquiry_id) : [];

  return (
    <>
      <AdminPageHeader
        title="Corporate"
        description="Companies whose business enquiry was won. Orders are matched by the contact's email. Each paid order counts as a campaign; plans aren't recorded yet."
      />
      <Panel>
        {accounts.length === 0 ? (
          <EmptyState title="No company accounts yet.">Mark an enquiry as won on the Enquiries screen to start tracking it here.</EmptyState>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Company</th>
                <th className={th}>Plan</th>
                <th className={thNum}>Campaigns</th>
                <th className={th}>Last campaign</th>
                <th className={thNum}>Total spend</th>
                <th className={th}>Account manager</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const health = HEALTH[account.health];
                return (
                  <tr key={account.enquiry_id} className={account.enquiry_id === selectedId ? "bg-surface" : "hover:bg-surface"}>
                    <td className={td}>
                      <Link href={`/admin/corporate?company=${account.enquiry_id}`} className="font-semibold text-brand hover:underline">{account.company}</Link>
                      <span className="block text-xs text-muted">{account.contact_name}</span>
                    </td>
                    <td className={td}>{account.plan ?? "—"}</td>
                    <td className={tdNum}>{account.campaigns}</td>
                    <td className={td}>{formatAdminDate(account.last_campaign_at)}</td>
                    <td className={tdNum}>{formatPrice(account.total_spend)}</td>
                    <td className={td}>{account.account_manager ?? "Unassigned"}</td>
                    <td className={td}>
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${health.className}`}>
                        <health.Icon aria-hidden="true" className="h-4 w-4" /> {health.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Panel>

      {selected ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel title={`${selected.company} · orders`} className="xl:col-span-2">
            {orders.filter((order) => order.buyer_id === selected.user_id).length === 0 ? (
              <EmptyState title="No paid orders yet.">{selected.user_id ? null : "No Givftme account uses this contact's email yet."}</EmptyState>
            ) : (
              <DataTable className="[&_table]:min-w-[420px]">
                <thead>
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Status</th>
                    <th className={thNum}>Value</th>
                    <th className={th}>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter((order) => order.buyer_id === selected.user_id).map((order) => (
                    <tr key={order.id}>
                      <td className={td}><Link href={`/admin/orders/${order.id}`} className="font-semibold text-brand hover:underline">#{shortId(order.id)}</Link></td>
                      <td className={td}>{humanize(order.status)}</td>
                      <td className={tdNum}>{formatPrice(Number(order.total_amount))}</td>
                      <td className={td}>{formatAdminDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Panel>
          <div className="space-y-6">
            <Panel title="Team members">
              {selected.user_id ? (
                <Link href={`/admin/people/${selected.user_id}`} className="text-sm font-medium text-brand hover:underline">{selected.contact_name} · {selected.email}</Link>
              ) : (
                <p className="text-sm text-muted">{selected.contact_name} ({selected.email ?? "no email"}) has no Givftme account yet.</p>
              )}
            </Panel>
            <Panel title="Communication history" description="Changes the team made to this enquiry.">
              {history.length === 0 ? <p className="text-sm text-muted">Nothing logged yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {history.map((entry, index) => (
                    <li key={index}>
                      <p className="text-ink">{entry.admin_name ?? "Team member"} · {humanize(entry.action)}</p>
                      <p className="text-xs text-muted">
                        {formatAdminDateTime(entry.created_at)}
                        {Object.keys(entry.metadata).length ? ` · ${Object.entries(entry.metadata).map(([key, value]) => `${humanize(key)}: ${String(value ?? "—")}`).join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
