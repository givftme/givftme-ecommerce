import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, DataTable, EmptyState, Panel, td, tdNum, th, thNum } from "@/components/admin/AdminUi";
import { ReminderFailureActions } from "@/components/admin/ModerationActions";
import { requireAdminScreen } from "@/lib/admin/auth";
import { listReminderFailures } from "@/lib/admin/data/moderation";
import { formatAdminDateTime, humanize } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reminder Failures" };

export default async function ReminderFailuresPage() {
  await requireAdminScreen("reminders", { path: "/admin/reminders" });
  const failures = await listReminderFailures(createServiceClient());

  return (
    <>
      <AdminPageHeader title="Reminder Failures" description="Reminders that failed five times and stopped retrying. Retry sends it on the next 15-minute run; dismiss clears it from this list." />
      <Panel>
        {failures.length === 0 ? <EmptyState title="No failed reminders." /> : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Person</th>
                <th className={th}>Occasion</th>
                <th className={th}>Channel</th>
                <th className={th}>Scheduled</th>
                <th className={thNum}>Retries</th>
                <th className={th}>Last attempt</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={failure.id}>
                  <td className={td}>
                    <Link href={`/admin/people/${failure.user_id}`} className="font-medium text-brand hover:underline">{failure.user_name ?? "Unnamed"}</Link>
                    <span className="block break-all text-xs text-muted">{failure.user_email ?? "No email on file"}</span>
                  </td>
                  <td className={td}>{failure.occasion}</td>
                  <td className={td}>{humanize(failure.channel)}</td>
                  <td className={td}>{formatAdminDateTime(failure.scheduled_at)}</td>
                  <td className={tdNum}>{failure.retry_count}</td>
                  <td className={td}>{formatAdminDateTime(failure.last_attempted_at)}</td>
                  <td className={td}><ReminderFailureActions reminderId={failure.id} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </>
  );
}
