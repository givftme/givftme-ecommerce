import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateRatingAggregates, type RatingAggregates } from "@/lib/reviews/aggregates";
import type { ProductReview, ProductReviewsSummary, ReviewsPage } from "@/lib/sanity/types";

export const REVIEWS_PAGE_SIZE = 10;

// Business rule #13 / spec's Backend Logic `isVerifiedPurchaser`: a user may
// review a catalog product only if they have a `delivered` order containing
// it. Checked here (server-side, in both the /reviews/new page and
// POST /api/reviews) rather than relying on RLS alone, per the spec's own
// Permissions note that RLS can't express this join.
export async function isVerifiedPurchaser(
  supabase: SupabaseClient,
  userId: string,
  catalogProductId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_items!inner(catalog_product_id)")
    .eq("buyer_id", userId)
    .eq("status", "delivered")
    .eq("order_items.catalog_product_id", catalogProductId)
    .limit(1);

  if (error) {
    return false;
  }

  return Boolean(data?.length);
}

interface ExistingReview {
  id: string;
  rating: number;
  body: string | null;
}

// Used by /reviews/new to detect edit mode (FR5: same route pre-fills when
// a review already exists) and by POST /api/reviews' update-vs-insert branch.
export async function getExistingReview(
  supabase: SupabaseClient,
  userId: string,
  catalogProductId: string
): Promise<ExistingReview | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body")
    .eq("user_id", userId)
    .eq("catalog_product_id", catalogProductId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as ExistingReview | null;
}

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

async function attachReviewers(
  supabase: SupabaseClient,
  rows: ReviewRow[]
): Promise<ProductReview[]> {
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: reviewers } =
    userIds.length > 0
      ? await supabase.from("users").select("id, full_name, avatar_url").in("id", userIds)
      : { data: [] as ReviewerProfile[] };

  const reviewerById = new Map(
    ((reviewers || []) as ReviewerProfile[]).map((reviewer) => [reviewer.id, reviewer])
  );

  return rows.map((row) => {
    const reviewer = reviewerById.get(row.user_id);

    return {
      id: row.id,
      userId: row.user_id,
      rating: row.rating,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewerName: reviewer?.full_name || null,
      reviewerAvatarUrl: reviewer?.avatar_url || null,
    };
  });
}

// Aggregates are computed by query, not a stored column (spec FR8), from
// every rating for the product — mirrors the spec's own "Rating aggregates
// query" verbatim rather than deriving from just the current page.
async function computeAggregates(
  supabase: SupabaseClient,
  catalogProductId: string
): Promise<RatingAggregates> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("catalog_product_id", catalogProductId);

  const ratings = error ? [] : ((data || []) as { rating: number }[]).map((row) => row.rating);

  return calculateRatingAggregates(ratings);
}

// Public, unauthenticated pagination source for GET /api/reviews — 10 per
// page, newest first (spec FR9).
export async function getReviewsPage(
  supabase: SupabaseClient,
  catalogProductId: string,
  page = 1
): Promise<ReviewsPage> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * REVIEWS_PAGE_SIZE;
  const to = from + REVIEWS_PAGE_SIZE - 1;

  const [{ data: rows, error }, aggregates] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, user_id, rating, body, created_at, updated_at")
      .eq("catalog_product_id", catalogProductId)
      .order("created_at", { ascending: false })
      .range(from, to),
    computeAggregates(supabase, catalogProductId),
  ]);

  const reviews = error ? [] : await attachReviewers(supabase, (rows || []) as ReviewRow[]);

  return {
    reviews,
    total: aggregates.count,
    average: aggregates.average,
    breakdown: aggregates.breakdown,
  };
}

// Server-rendered summary for the product detail page's Reviews tab —
// page 1 of the same pagination plus `canLeaveReview`, which only the
// initial SSR render needs (the client "Load more" flow reads subsequent
// pages straight from GET /api/reviews, which has no such field).
export async function getProductReviewsSummary(
  supabase: SupabaseClient,
  catalogProductId: string
): Promise<ProductReviewsSummary> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [page, eligible, existingReview] = await Promise.all([
    getReviewsPage(supabase, catalogProductId, 1),
    user ? isVerifiedPurchaser(supabase, user.id, catalogProductId) : Promise.resolve(false),
    user ? getExistingReview(supabase, user.id, catalogProductId) : Promise.resolve(null),
  ]);

  return {
    count: page.total,
    avg: page.average,
    breakdown: page.breakdown,
    reviews: page.reviews,
    // Eligible AND doesn't already have one — an existing reviewer edits via
    // their own review card's "Edit" link instead (manual QA: the CTA
    // reappears only after the review is deleted).
    canLeaveReview: eligible && !existingReview,
    hasMore: page.total > page.reviews.length,
  };
}

type ReviewMutationResult =
  | { ok: true; review: ReviewRow }
  | { ok: false; status: number; error: string };

// Mirrors the spec's Backend Logic for POST /api/reviews verbatim,
// including its own internal inconsistency: Edge Case #2 says a concurrent
// duplicate insert should silently update instead of erroring, but the
// literal pseudocode below returns 409 on a 23505 unique-violation instead
// (that branch only fires when the initial existence check raced a
// concurrent insert). Implemented as written, same "document the
// contradiction rather than silently resolve it" call as the order-status
// transition map in migration 019.
export async function createOrUpdateReview(
  supabase: SupabaseClient,
  userId: string,
  input: { catalog_product_id: string; rating: number; body?: string }
): Promise<ReviewMutationResult> {
  const eligible = await isVerifiedPurchaser(supabase, userId, input.catalog_product_id);

  if (!eligible) {
    return {
      ok: false,
      status: 403,
      error: "You need to have purchased and received this product to leave a review.",
    };
  }

  const existing = await getExistingReview(supabase, userId, input.catalog_product_id);

  if (existing) {
    const { data, error } = await supabase
      .from("reviews")
      .update({ rating: input.rating, body: input.body ?? null })
      .eq("id", existing.id)
      .select("id, user_id, rating, body, created_at, updated_at")
      .single();

    if (error || !data) {
      return { ok: false, status: 500, error: "Couldn't submit your review. Please try again." };
    }

    return { ok: true, review: data as ReviewRow };
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: userId,
      catalog_product_id: input.catalog_product_id,
      rating: input.rating,
      body: input.body ?? null,
    })
    .select("id, user_id, rating, body, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        status: 409,
        error: "You've already reviewed this product. Edit your existing review instead.",
      };
    }

    return { ok: false, status: 500, error: "Couldn't submit your review. Please try again." };
  }

  return { ok: true, review: data as ReviewRow };
}

export async function updateOwnReview(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  input: { rating?: number; body?: string }
): Promise<ReviewMutationResult> {
  const { data: existing, error: fetchError } = await supabase
    .from("reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, status: 404, error: "Review not found." };
  }

  if ((existing as { user_id: string }).user_id !== userId) {
    return { ok: false, status: 403, error: "You can only edit your own review." };
  }

  const patch: { rating?: number; body?: string | null } = {};
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.body !== undefined) patch.body = input.body;

  const { data, error } = await supabase
    .from("reviews")
    .update(patch)
    .eq("id", reviewId)
    .select("id, user_id, rating, body, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, status: 500, error: "Couldn't submit your review. Please try again." };
  }

  return { ok: true, review: data as ReviewRow };
}

type ReviewDeleteResult = { ok: true } | { ok: false; status: number; error: string };

// FR6: hard-delete (v1 simplification the spec itself calls out). Aggregates
// are computed by query (FR8), so nothing further needs decrementing.
export async function deleteOwnReview(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string
): Promise<ReviewDeleteResult> {
  const { data: existing, error: fetchError } = await supabase
    .from("reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, status: 404, error: "Review not found." };
  }

  if ((existing as { user_id: string }).user_id !== userId) {
    return { ok: false, status: 403, error: "You can only delete your own review." };
  }

  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  if (error) {
    return { ok: false, status: 500, error: "Couldn't delete your review. Please try again." };
  }

  return { ok: true };
}
