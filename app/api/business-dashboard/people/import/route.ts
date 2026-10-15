import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { importPeople } from "@/lib/business-dashboard/actions";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { NO_PERMISSION_MESSAGE } from "@/lib/business-dashboard/permissions";
import { importRequestSchema } from "@/lib/business-dashboard/validation";

// Bulk import of validated CSV rows into business_people. The importPeople
// server action does the work, so both paths apply the same rules.
export async function POST(request: Request) {
  const { member, response } = await requireBusinessApi("edit_people");
  if (!member) return response;

  const parsed = importRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the rows and try again.", 400);

  const result = await importPeople(member.account_id, parsed.data.people, parsed.data.kind);
  if (!result.ok) return jsonError(result.error, result.error === NO_PERMISSION_MESSAGE ? 403 : 500);
  return NextResponse.json(result.data, { status: 201 });
}
