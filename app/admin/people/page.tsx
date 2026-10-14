import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, DataTable, EmptyState, Panel, RoleBadge, smallInput, td, th } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { requireAdminScreen } from "@/lib/admin/auth";
import { searchPeople } from "@/lib/admin/data/people";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  await requireAdminScreen("people", { path: "/admin/people", action: query ? "search_people" : "view_screen" });
  const people = await searchPeople(createServiceClient(), query);

  return (
    <>
      <AdminPageHeader title="People" description="Search by name, email, or phone. With no search, the most recently active people are listed." />
      <Panel className="mb-6">
        <form action="/admin/people" role="search" className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="people-q" className="sr-only">Search people</label>
          <input id="people-q" name="q" type="search" defaultValue={query} placeholder="Name, email, or phone" className={`${smallInput} sm:flex-1`} />
          <Button type="submit" size="sm" className="h-10">Search</Button>
        </form>
      </Panel>
      <Panel>
        {people.length === 0 ? (
          <EmptyState title={query ? `Nobody matches “${query}”.` : "No people yet."} />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>City</th>
                <th className={th}>Signed up</th>
                <th className={th}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="hover:bg-surface">
                  <td className={td}>
                    <Link href={`/admin/people/${person.id}`} className="font-semibold text-brand hover:underline">{person.full_name || "Unnamed"}</Link>
                    {person.role ? <span className="ml-2"><RoleBadge>{ROLE_LABELS[person.role]}</RoleBadge></span> : null}
                  </td>
                  <td className={`${td} break-all`}>{person.email ?? "—"}</td>
                  <td className={td}>{person.city ?? "—"}</td>
                  <td className={td}>{formatAdminDate(person.signed_up_at)}</td>
                  <td className={td}>{formatAdminDateTime(person.last_active_at)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </>
  );
}
