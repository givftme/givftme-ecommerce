import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { deleteReviewAsAdmin } from "@/lib/admin/data/moderation";
import { jsonError } from "@/lib/api/response";

interface ReviewRouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: ReviewRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Review not found.", 404);

  const auth = await requireAdminApi("reviews");
  if (!auth.ok) return auth.response;
  try {
    const result = await deleteReviewAsAdmin(auth.service, auth.member.id, id);
    return result.ok ? NextResponse.json({ deleted: true }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not delete review.", error);
    return jsonError("Couldn't delete the review. Try again.", 500);
  }
}
