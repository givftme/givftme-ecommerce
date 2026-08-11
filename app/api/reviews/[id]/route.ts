import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { deleteOwnReview, updateOwnReview } from "@/lib/reviews/server";
import { updateReviewSchema } from "@/lib/reviews/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ReviewRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: ReviewRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = updateReviewSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Check your review and try again.", 400);
  }

  const result = await updateOwnReview(supabase, user.id, id, parsed.data);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ review: result.review });
}

export async function DELETE(_request: Request, context: ReviewRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const result = await deleteOwnReview(supabase, user.id, id);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ deleted: true });
}
