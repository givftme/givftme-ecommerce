import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getCohorts } from "@/lib/admin/data/growth";
import { jsonError } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdminApi("growth", { audit: { action: "read_cohorts", targetType: "screen", targetId: "growth" } });
  if (!auth.ok) return auth.response;
  const weeks = Number.parseInt(new URL(request.url).searchParams.get("weeks") || "12", 10);
  try {
    const cohorts = await getCohorts(auth.service, Number.isFinite(weeks) ? Math.min(Math.max(weeks, 1), 52) : 12);
    return NextResponse.json({ cohorts });
  } catch (error) {
    console.error("Could not load cohort retention.", error);
    return jsonError("Couldn't load cohorts. Try again.", 500);
  }
}
