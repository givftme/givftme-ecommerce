import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { AdminPageHeader, DataTable, EmptyState, Panel, RoleBadge, StatTile, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { PersonDangerZone } from "@/components/admin/PersonDangerZone";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { isUuid, requireAdminScreen } from "@/lib/admin/auth";
import { getPersonRecord } from "@/lib/admin/data/people";
import { formatAdminDate, formatAdminDateTime, humanize, shortId } from "@/lib/admin/format";
import { ROLE_LABELS } from "@/lib/admin/roles";
import type { OrderStatus } from "@/lib/orders/types";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Person" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value
    ? <span className="inline-flex items-center gap-1 text-success"><Check aria-hidden="true" className="h-4 w-4" /> Yes</span>
    : <span className="inline-flex items-center gap-1 text-muted"><Minus aria-hidden="true" className="h-4 w-4" /> No</span>;
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Every visit is logged as view_person (spec, Screen 12).
  await requireAdminScreen("people", { path: `/admin/people/${id}`, action: "view_person", targetType: "user", targetId: id });
  const person = await getPersonRecord(createServiceClient(), id);
  if (!person) notFound();

  const { profile, calendar, lists, pools, orders, messages, activity, value, consent } = person;
  const name = profile.full_name || "Unnamed";

  return (
    <>
      <Link href="/admin/people" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> People
      </Link>
      <AdminPageHeader
        title={name}
        description={profile.email ?? undefined}
        actions={profile.role ? <RoleBadge>{ROLE_LABELS[profile.role]}</RoleBadge> : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total spent" value={formatPrice(value.totalSpent)} hint="Paid catalog orders" />
        <StatTile label="Gifts given" value={value.giftsGiven.toLocaleString("en-NG")} hint="Claims and orders they made" />
        <StatTile label="Gifts received" value={value.giftsReceived.toLocaleString("en-NG")} hint="Count only, givers not shown" />
        <StatTile label="Estimated LTV" value={value.estimatedLtv == null ? "—" : formatPrice(value.estimatedLtv)} hint="Monthly spend × 24" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Profile">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Name">{name}</Field>
            <Field label="Phone">{profile.phone ?? "—"}</Field>
            <Field label="Email">{profile.email ?? "—"}</Field>
            <Field label="City">{profile.city ?? "—"}</Field>
            <Field label="Signed up">{formatAdminDate(profile.signed_up_at)}</Field>
            <Field label="Source">{[profile.signup_source, profile.signup_channel].filter(Boolean).map((part) => humanize(part)).join(" · ") || "—"}</Field>
            <Field label="Last sign-in">{formatAdminDateTime(profile.last_sign_in_at)}</Field>
            <Field label="Language">{profile.language ?? "Not tracked"}</Field>
            <Field label="Plus">{profile.plus == null ? "Not tracked" : <YesNo value={profile.plus} />}</Field>
            <Field label="Team role">{profile.role ? ROLE_LABELS[profile.role] : "Customer"}</Field>
          </dl>
        </Panel>

        <Panel title="Their calendar" description={`${calendar.dates.length} saved dates · streak ${calendar.streakMonths ?? "—"} months`}>
          {calendar.nextUpcoming ? (
            <p className="mb-3 rounded-xl bg-surface px-3 py-2 text-sm text-ink">
              Next: <strong>{calendar.nextUpcoming.person_name}</strong> · {humanize(calendar.nextUpcoming.occasion_type)} on {formatAdminDate(calendar.nextUpcoming.date)}
            </p>
          ) : null}
          {calendar.dates.length === 0 ? <EmptyState title="No saved dates." /> : (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto text-sm">
              {calendar.dates.map((date) => (
                <li key={date.id} className="flex justify-between gap-3 py-2">
                  <span className="text-ink">{date.person_name} · {humanize(date.occasion_type)}</span>
                  <span className="shrink-0 text-muted">{formatAdminDate(date.date)}{date.is_recurring ? " · yearly" : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {calendar.missed.length ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Missed dates</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {calendar.missed.map((missed, index) => (
                  <li key={index} className="text-ink">{humanize(missed.occasion)} · {missed.days_late ?? "?"} days late · {formatAdminDate(missed.created_at)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="Lists & pools">
          {lists.length === 0 ? <EmptyState title="No wishlists." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Wishlist</th>
                  <th className={th}>Visibility</th>
                  <th className={thNum}>Items</th>
                  <th className={thNum}>Shares</th>
                  <th className={thNum}>Claimed</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((list) => (
                  <tr key={list.id}>
                    <td className={td}>{list.title}{list.occasion_title ? <span className="block text-xs text-muted">{list.occasion_title}</span> : <span className="block text-xs text-muted">{humanize(list.type)}</span>}</td>
                    <td className={td}>{humanize(list.visibility)}</td>
                    <td className={tdNum}>{list.item_count}</td>
                    <td className={tdNum}>{list.share_count}</td>
                    <td className={tdNum}>{list.claimed_count}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Pools created or receiving</h3>
              {pools.created.length === 0 ? <p className="mt-1 text-sm text-muted">None.</p> : (
                <ul className="mt-1 space-y-1 text-sm">
                  {pools.created.map((pool) => (
                    <li key={pool.id} className="text-ink">{pool.title} · {formatPrice(pool.amount_raised)} of {formatPrice(pool.target_amount)} · {humanize(pool.status)} <span className="text-muted">({pool.role})</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Contributions</h3>
              {pools.contributions.length === 0 ? <p className="mt-1 text-sm text-muted">None.</p> : (
                <ul className="mt-1 space-y-1 text-sm">
                  {pools.contributions.map((contribution) => (
                    <li key={contribution.id} className="text-ink">{contribution.pool_title ?? "Pool"} · {formatPrice(contribution.amount)} · {humanize(contribution.status)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Orders">
          {orders.length === 0 ? <EmptyState title="No orders." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Status</th>
                  <th className={thNum}>Value</th>
                  <th className={th}>Placed</th>
                  <th className={th}>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className={td}><Link href={`/admin/orders/${order.id}`} className="font-semibold text-brand hover:underline">#{shortId(order.id)}</Link></td>
                    <td className={td}><OrderStatusBadge status={order.status as OrderStatus} /></td>
                    <td className={tdNum}>{formatPrice(order.total_amount)}</td>
                    <td className={td}>{formatAdminDate(order.created_at)}</td>
                    <td className={td}>{formatAdminDate(order.estimated_delivery)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Messages" description="Reminders sent to them, and whether each was opened or acted on.">
          {messages.length === 0 ? <EmptyState title="No reminders sent." /> : (
            <DataTable>
              <thead>
                <tr>
                  <th className={th}>Sent</th>
                  <th className={th}>Channel</th>
                  <th className={thNum}>Days before</th>
                  <th className={th}>Opened</th>
                  <th className={th}>Actioned</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message, index) => (
                  <tr key={`${message.message_id}-${index}`}>
                    <td className={td}>{formatAdminDateTime(message.sent_at)}</td>
                    <td className={td}>{humanize(message.channel)}</td>
                    <td className={tdNum}>{message.days_before ?? "—"}</td>
                    <td className={td}><YesNo value={message.opened} /></td>
                    <td className={td}><YesNo value={message.actioned} /></td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Consent & privacy">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Email marketing">
              {consent.email.subscribed ? <>Subscribed {formatAdminDate(consent.email.since)}<span className="block text-xs text-muted">{consent.email.source}</span></> : "No consent recorded"}
            </Field>
            <Field label="Invite reminders">{consent.inviteReminderOptIns ? `Opted in on ${consent.inviteReminderOptIns} list(s)` : "None"}</Field>
            <Field label="WhatsApp">No consent recorded</Field>
            <Field label="SMS">No consent recorded</Field>
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <PersonDangerZone userId={profile.id} name={name} isTeamMember={Boolean(profile.role)} />
          </div>
        </Panel>
      </div>

      <Panel title="Activity timeline" description="Every event for this person, newest first (latest 200)." className="mt-6">
        {activity.length === 0 ? <EmptyState title="No activity recorded yet." /> : (
          <ol className="space-y-3">
            {activity.map((event) => (
              <li key={event.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{event.event}</span>
                  <span className="text-xs text-muted">
                    {formatAdminDateTime(event.created_at)}
                    {[event.device, event.city, event.country].filter(Boolean).length ? ` · ${[event.device, event.city, event.country].filter(Boolean).join(" · ")}` : ""}
                  </span>
                </div>
                {Object.keys(event.props || {}).length ? (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2 text-xs text-ink">{JSON.stringify(event.props, null, 2)}</pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
