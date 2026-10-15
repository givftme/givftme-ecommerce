import { jsonError } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { listBusinessCampaigns, listBusinessPeople } from "@/lib/business-dashboard/queries";
import { lagosToday, scheduleCsv, toIsoDate, upcomingMoments } from "@/lib/business-dashboard/utils";
import { recordRequestEvent } from "@/lib/events/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The year's schedule as CSV (Date, Type, Name, Details, Days away): every
// upcoming moment in the next 365 days. The dashboard downloads it through a
// Blob URL.
export async function GET() {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  try {
    const service = createServiceClient();
    const [people, campaigns] = await Promise.all([
      listBusinessPeople(service, member.account_id),
      listBusinessCampaigns(service, member.account_id, member),
    ]);
    const today = lagosToday();
    const moments = upcomingMoments(people, campaigns, 365, today);
    await recordRequestEvent({
      event: "business.export.schedule",
      userId: member.user_id,
      props: { account_id: member.account_id, rows: moments.length },
    });
    return new Response(scheduleCsv(moments), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="givftme-schedule-${toIsoDate(today)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not export business schedule.", error);
    return jsonError("Couldn't export the schedule. Please try again.", 500);
  }
}
