import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getPulse } from "@/lib/admin/data/pulse";
import { jsonError } from "@/lib/api/response";

export async function GET() {
  const auth = await requireAdminApi("pulse", { audit: { action: "read_pulse", targetType: "screen", targetId: "pulse" } });
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await getPulse(auth.service));
  } catch (error) {
    console.error("Could not load pulse.", error);
    return jsonError("Couldn't load the pulse. Try again.", 500);
  }
}
