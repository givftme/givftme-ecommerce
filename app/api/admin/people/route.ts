import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { searchPeople } from "@/lib/admin/data/people";
import { jsonError } from "@/lib/api/response";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  const auth = await requireAdminApi("people", { audit: { action: "search_people", targetType: "screen", targetId: "people", metadata: { query } } });
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ people: await searchPeople(auth.service, query) });
  } catch (error) {
    console.error("Could not search people.", error);
    return jsonError("Couldn't search people. Try again.", 500);
  }
}
