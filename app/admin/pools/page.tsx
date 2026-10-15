import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/admin/AdminCharts";
import { AdminPageHeader, DataTable, EmptyState, Panel, TabLinks, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { PayoutActions } from "@/components/admin/PayoutActions";
import { requireAdminScreen } from "@/lib/admin/auth";
import { listActivePools, listPayoutQueue } from "@/lib/admin/data/pools";
import { formatAdminDate, humanize } from "@/lib/admin/format";
import { canPerform } from "@/lib/admin/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Pools" };

const TABS = [
  { value: "active", label: "Active pools" },
  { value: "payouts", label: "Payouts queue" },
] as const;

export default async function AdminPoolsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "payouts" ? "payouts" : "active";
  const member = await requireAdminScreen("pools", { path: `/admin/pools?tab=${tab}` });
  const service = createServiceClient();
  const canUpdate = canPerform(member.role, "updatePayout");

  return (
    <>
      <AdminPageHeader
        title="Pools"
        description="Group gifts in progress, and cash-outs waiting for a manual bank transfer."
        actions={<TabLinks label="Pool views" options={TABS} active={tab} hrefFor={(value) => `/admin/pools?tab=${value}`} />}
      />
      {tab === "active" ? <ActivePools service={service} /> : <PayoutQueue service={service} canUpdate={canUpdate} />}
    </>
  );
}

async function ActivePools({ service }: { service: ReturnType<typeof createServiceClient> }) {
  const pools = await listActivePools(service);
  return (
    <Panel title="Open and fully funded">
      {pools.length === 0 ? <EmptyState title="No active pools." /> : (
        <DataTable>
          <thead>
            <tr>
              <th className={th}>Pool</th>
              <th className={th}>Receiver</th>
              <th className={th}>Type</th>
              <th className={thNum}>Target</th>
              <th className={thNum}>Raised</th>
              <th className={th}>Progress</th>
              <th className={thNum}>Contributors</th>
              <th className={th}>Created</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <tr key={pool.id}>
                <td className={td}>{pool.title}<span className="block text-xs text-muted">{humanize(pool.status)}</span></td>
                <td className={td}>{pool.receiver_name ?? "—"}</td>
                <td className={td}>{pool.type === "item" ? "Item" : "General"}</td>
                <td className={tdNum}>{formatPrice(pool.target_amount)}</td>
                <td className={tdNum}>{formatPrice(pool.amount_raised)}</td>
                <td className={td}>
                  <span className="text-xs tabular-nums text-ink">{pool.percent}%</span>
                  <ProgressBar percent={pool.percent} className="mt-1 w-24" />
                </td>
                <td className={tdNum}>{pool.contributor_count}</td>
                <td className={td}>{formatAdminDate(pool.created_at)}</td>
                <td className={td}>
                  <Link href={`/pool/${pool.token}`} target="_blank" className="text-sm font-medium text-brand hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}

async function PayoutQueue({ service, canUpdate }: { service: ReturnType<typeof createServiceClient>; canUpdate: boolean }) {
  const payouts = await listPayoutQueue(service);
  return (
    <Panel title="Payouts queue" description="Oldest first. A payout stays here until the completed transfer is recorded.">
      {payouts.length === 0 ? <EmptyState title="Nothing waiting to be paid out." /> : (
        <DataTable>
          <thead>
            <tr>
              <th className={th}>Pool</th>
              <th className={th}>Receiver</th>
              <th className={thNum}>Amount to pay</th>
              <th className={th}>Requested</th>
              <th className={th}>Status</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id}>
                <td className={td}>{payout.pool_title ?? "—"}</td>
                <td className={td}>{payout.receiver_name ?? "—"}<span className="block break-all text-xs text-muted">{payout.receiver_email ?? ""}</span></td>
                <td className={`${tdNum} font-semibold`}>{formatPrice(payout.amount)}</td>
                <td className={td}>{formatAdminDate(payout.created_at)}</td>
                <td className={td}>{payout.status === "processing" ? "Processing" : "Pending"}</td>
                <td className={td}>
                  <PayoutActions
                    payoutId={payout.id}
                    status={payout.status}
                    amount={payout.amount}
                    receiver={payout.receiver_name ?? "the receiver"}
                    canUpdate={canUpdate}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}
