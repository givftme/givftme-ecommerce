import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { listBusinessDeliveries } from "@/lib/business-dashboard/queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Proof of delivery records: scheduled ones first, then newest deliveries.
export async function GET() {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  try {
    const deliveries = await listBusinessDeliveries(createServiceClient(), member.account_id);
    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error("Could not list business deliveries.", error);
    return jsonError("Couldn't load your deliveries. Please try again.", 500);
  }
}
