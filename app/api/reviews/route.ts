import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { createOrUpdateReview, getReviewsPage } from "@/lib/reviews/server";
import { reviewSchema } from "@/lib/reviews/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Check your review and try again.", 400);
  }

  const result = await createOrUpdateReview(supabase, user.id, parsed.data);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ review: result.review }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  if (!productId) {
    return jsonError("product_id is required.", 400);
  }

  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const supabase = await createClient();
  const result = await getReviewsPage(supabase, productId, Number.isNaN(page) ? 1 : page);

  return NextResponse.json(result);
}
