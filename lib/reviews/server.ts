import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductReview, ProductReviewsSummary } from "@/lib/sanity/types";

function emptyReviews(canLeaveReview = false): ProductReviewsSummary {
  return {
    count: 0,
    avg: 0,
    breakdown: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 })),
    reviews: [],
    canLeaveReview,
  };
}

export async function getProductReviewsSummary(
  supabase: SupabaseClient,
  productId: string
): Promise<ProductReviewsSummary> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: reviewRows, error: reviewsError }, canLeaveReview] =
    await Promise.all([
      supabase
        .from("reviews")
        .select("id, rating, body, created_at")
        .eq("catalog_product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50),
      user ? canUserReviewProduct(supabase, user.id, productId) : false,
    ]);

  if (reviewsError) {
    return emptyReviews(canLeaveReview);
  }

  const reviews: ProductReview[] = (reviewRows || []).map((row) => {
    const review = row as {
      id?: string;
      rating?: number;
      body?: string | null;
      created_at?: string | null;
    };

    return {
      id: review.id || crypto.randomUUID(),
      rating: review.rating || 0,
      body: review.body || null,
      createdAt: review.created_at || null,
      reviewerName: null,
    };
  });
  const count = reviews.length;

  if (count === 0) {
    return emptyReviews(canLeaveReview);
  }

  const avg = reviews.reduce((sum, review) => sum + review.rating, 0) / count;
  const breakdown = [5, 4, 3, 2, 1].map((star) => {
    const starCount = reviews.filter((review) => review.rating === star).length;

    return {
      star,
      count: starCount,
      pct: Math.round((starCount / count) * 100),
    };
  });

  return {
    count,
    avg,
    breakdown,
    reviews,
    canLeaveReview,
  };
}

async function canUserReviewProduct(
  supabase: SupabaseClient,
  userId: string,
  productId: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_items!inner(catalog_product_id)")
    .eq("buyer_id", userId)
    .eq("status", "delivered")
    .eq("order_items.catalog_product_id", productId)
    .limit(1);

  if (error) {
    return false;
  }

  return Boolean(data?.length);
}
