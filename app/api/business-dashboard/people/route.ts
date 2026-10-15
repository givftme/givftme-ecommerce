import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { listBusinessPeople } from "@/lib/business-dashboard/queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The signed-in member's active staff and clients.
export async function GET() {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  try {
    const people = await listBusinessPeople(createServiceClient(), member.account_id);
    return NextResponse.json({
      staff: people.filter((person) => person.kind === "staff"),
      clients: people.filter((person) => person.kind === "client"),
    });
  } catch (error) {
    console.error("Could not list business people.", error);
    return jsonError("Couldn't load your people. Please try again.", 500);
  }
}
