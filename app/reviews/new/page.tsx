import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ReviewForm } from "@/components/review/ReviewForm";
import { normalizeProductFull } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { PRODUCT_BY_ID_QUERY } from "@/lib/sanity/queries";
import { getExistingReview, isVerifiedPurchaser } from "@/lib/reviews/server";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import type { ProductFullData } from "@/lib/sanity/types";

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>;
}) {
  const { product_id: productId } = await searchParams;

  if (!productId) {
    // No toast-via-redirect convention exists anywhere in this codebase
    // (same call made for 14-SEARCH.md's breadcrumb gap) — redirecting to
    // /shop without one is a deliberate simplification, not an oversight.
    redirect("/shop");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts protects /reviews, so `user` should always be set here — this
  // is defense in depth, not the primary auth gate.
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/reviews/new?product_id=${productId}`)}`);
  }

  const rawProduct = await sanityFetch<ProductFullData | null>(PRODUCT_BY_ID_QUERY, {
    id: productId,
  });

  if (!rawProduct) {
    redirect("/shop");
  }

  const product = normalizeProductFull(rawProduct);
  const [existingReview, eligible] = await Promise.all([
    getExistingReview(supabase, user.id, productId),
    isVerifiedPurchaser(supabase, user.id, productId),
  ]);

  trackEvent("review.submission_page.viewed", {
    product_id: productId,
    is_eligible: eligible || Boolean(existingReview),
  });

  if (!existingReview && !eligible) {
    return (
      <PageWrapper>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-ink">Not eligible to review this item</h1>
          <p className="mt-3 text-sm text-muted">
            You need to have purchased and received this product to leave a review.
          </p>
          <Link
            href={`/product/${product.slug}`}
            className="mt-6 inline-block text-sm font-semibold text-brand"
          >
            Back to product
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
            {product.images[0]?.url ? (
              <Image
                src={product.images[0].url}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Your review for</p>
            <h1 className="text-lg font-bold text-ink">{product.title}</h1>
          </div>
        </div>

        <ReviewForm
          productId={productId}
          productSlug={product.slug}
          existingReview={existingReview}
        />
      </div>
    </PageWrapper>
  );
}
