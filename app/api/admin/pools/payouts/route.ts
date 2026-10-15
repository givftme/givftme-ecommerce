import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { listPayoutQueue } from "@/lib/admin/data/pools";
import { jsonError } from "@/lib/api/response";

export async function GET() {
  const auth = await requireAdminApi("pools", { audit: { action: "list_payouts", targetType: "screen", targetId: "pools" } });
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ payouts: await listPayoutQueue(auth.service) });
  } catch (error) {
    console.error("Could not list pool payouts.", error);
    return jsonError("Couldn't load payouts. Try again.", 500);
  }
}
