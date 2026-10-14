import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { updatePayout } from "@/lib/admin/data/pools";
import { payoutUpdateSchema } from "@/lib/admin/validation";
import { jsonError, readJson } from "@/lib/api/response";

interface PayoutRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: PayoutRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Payout not found.", 404);

  const auth = await requireAdminApi("pools", { action: "updatePayout" });
  if (!auth.ok) return auth.response;

  const parsed = payoutUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the transfer details and try again.", 400);

  try {
    const result = await updatePayout(auth.service, { id: auth.member.id, email: auth.member.email }, id, parsed.data);
    return result.ok ? NextResponse.json({ status: parsed.data.status }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not update pool payout.", error);
    return jsonError("Couldn't update the payout. Try again.", 500);
  }
}
