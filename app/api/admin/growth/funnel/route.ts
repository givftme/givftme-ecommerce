import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getFunnel } from "@/lib/admin/data/growth";
import { jsonError } from "@/lib/api/response";

export async function GET() {
  const auth = await requireAdminApi("growth", { audit: { action: "read_funnel", targetType: "screen", targetId: "growth" } });
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ steps: await getFunnel(auth.service) });
  } catch (error) {
    console.error("Could not load activation funnel.", error);
    return jsonError("Couldn't load the funnel. Try again.", 500);
  }
}
