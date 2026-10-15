import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { listBusinessCampaigns, listBusinessPeople } from "@/lib/business-dashboard/queries";
import { lagosToday, toIsoDate, upcomingMoments } from "@/lib/business-dashboard/utils";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Computed upcoming moments (`?days=`, default 30, at most 365), counted in
// Lagos calendar days.
export async function GET(request: Request) {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  const requested = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Number.isInteger(requested) && requested >= 0 ? Math.min(requested, 365) : 30;

  try {
    const service = createServiceClient();
    const [people, campaigns] = await Promise.all([
      listBusinessPeople(service, member.account_id),
      listBusinessCampaigns(service, member.account_id, member),
    ]);
    const moments = upcomingMoments(people, campaigns, days, lagosToday()).map((moment) => ({
      ...moment,
      date: toIsoDate(moment.date),
    }));
    return NextResponse.json({ days, moments });
  } catch (error) {
    console.error("Could not compute business upcoming moments.", error);
    return jsonError("Couldn't load upcoming moments. Please try again.", 500);
  }
}
