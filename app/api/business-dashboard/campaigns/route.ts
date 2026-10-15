import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { listBusinessCampaigns } from "@/lib/business-dashboard/queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Campaigns by delivery date; limited members see only their own.
export async function GET() {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  try {
    const campaigns = await listBusinessCampaigns(createServiceClient(), member.account_id, member);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Could not list business campaigns.", error);
    return jsonError("Couldn't load your campaigns. Please try again.", 500);
  }
}
