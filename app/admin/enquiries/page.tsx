import type { Metadata } from "next";
import { AdminPageHeader, EmptyState, Panel } from "@/components/admin/AdminUi";
import { EnquiryControls } from "@/components/admin/ModerationActions";
import { requireAdminScreen } from "@/lib/admin/auth";
import { listEnquiries, listTeamMembers } from "@/lib/admin/data/moderation";
import { formatAdminDate } from "@/lib/admin/format";
import { ENQUIRY_STATUSES } from "@/lib/admin/validation";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business Enquiries" };

const STATUS_TITLES: Record<(typeof ENQUIRY_STATUSES)[number], string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

export default async function EnquiriesPage() {
  await requireAdminScreen("enquiries", { path: "/admin/enquiries" });
  const service = createServiceClient();
  const [enquiries, members] = await Promise.all([listEnquiries(service), listTeamMembers(service)]);
  const team = members.map((member) => ({ id: member.id, name: member.full_name || member.email || "Team member" }));

  return (
    <>
      <AdminPageHeader title="Business Enquiries" description="Briefs from the /business Experience Centre form, grouped by stage." />
      <div className="space-y-8">
        {ENQUIRY_STATUSES.map((status) => {
          const rows = enquiries.filter((enquiry) => enquiry.status === status);
          return (
            <section key={status} aria-labelledby={`enquiries-${status}`}>
              <h2 id={`enquiries-${status}`} className="mb-3 text-base font-semibold text-ink">
                {STATUS_TITLES[status]} <span className="text-sm font-normal text-muted">({rows.length})</span>
              </h2>
              {rows.length === 0 ? <EmptyState title={`No ${STATUS_TITLES[status].toLowerCase()} enquiries.`} /> : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {rows.map((enquiry) => (
                    <Panel key={enquiry.id} title={enquiry.company_name} description={`Received ${formatAdminDate(enquiry.created_at)}${enquiry.reference ? ` · ${enquiry.reference}` : ""}`}>
                      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs text-muted">Contact</dt><dd className="text-ink">{enquiry.contact_name}</dd></div>
                        <div><dt className="text-xs text-muted">Team size</dt><dd className="text-ink">{enquiry.team_size ?? "—"}</dd></div>
                        <div className="min-w-0"><dt className="text-xs text-muted">Email</dt><dd className="break-all text-ink">{enquiry.email ? <a href={`mailto:${enquiry.email}`} className="text-brand hover:underline">{enquiry.email}</a> : "—"}</dd></div>
                        <div><dt className="text-xs text-muted">Phone</dt><dd className="text-ink">{enquiry.phone ? <a href={`tel:${enquiry.phone}`} className="text-brand hover:underline">{enquiry.phone}</a> : "—"}</dd></div>
                        <div><dt className="text-xs text-muted">Needed by</dt><dd className="text-ink">{formatAdminDate(enquiry.needed_by)}</dd></div>
                        <div><dt className="text-xs text-muted">Occasions</dt><dd className="text-ink">{enquiry.occasions?.length ? enquiry.occasions.join(", ") : "—"}</dd></div>
                      </dl>
                      <EnquiryControls enquiryId={enquiry.id} status={enquiry.status} assignedTo={enquiry.assigned_to} notes={enquiry.notes} team={team} />
                    </Panel>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
