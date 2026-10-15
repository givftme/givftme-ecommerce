import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { updateEnquiry } from "@/lib/admin/data/moderation";
import { enquiryUpdateSchema } from "@/lib/admin/validation";
import { jsonError, readJson } from "@/lib/api/response";

interface EnquiryRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: EnquiryRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Enquiry not found.", 404);

  const auth = await requireAdminApi("enquiries");
  if (!auth.ok) return auth.response;

  const parsed = enquiryUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the enquiry details and try again.", 400);

  try {
    const result = await updateEnquiry(auth.service, auth.member.id, id, parsed.data);
    return result.ok ? NextResponse.json({ updated: true }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not update enquiry.", error);
    return jsonError("Couldn't update the enquiry. Try again.", 500);
  }
}
