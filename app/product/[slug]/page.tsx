import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProductDetail } from "@/components/product/ProductDetail";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { normalizeProductCards, normalizeProductFull } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { PRODUCT_PAGE_QUERY, RELATED_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import { createClient } from "@/lib/supabase/server";
import { getProductReviewsSummary } from "@/lib/reviews/server";
import type { ProductCardData, ProductFullData } from "@/lib/sanity/types";

export const revalidate = 60;

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rawProduct = await sanityFetch<ProductFullData | null>(
    PRODUCT_PAGE_QUERY,
    { slug }
  );

  if (!rawProduct) {
    notFound();
  }

  const product = normalizeProductFull(rawProduct);
  const collectionIds = product.collections.map((collection) => collection.id);
  const supabase = await createClient();
  const [reviews, relatedRaw] = await Promise.all([
    getProductReviewsSummary(supabase, product.catalogProductId),
    collectionIds.length > 0
      ? sanityFetch<ProductCardData[]>(RELATED_PRODUCTS_QUERY, {
          productId: product.catalogProductId,
          collectionIds,
        })
      : Promise.resolve([]),
  ]);
  const relatedProducts = normalizeProductCards(relatedRaw);
  const displayPrice = product.price ?? product.compareAtPrice ?? 0;
  const isAvailable = product.hasVariants
    ? product.variants.some((variant) => variant.available)
    : typeof product.price === "number";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    image: product.images[0]?.url,
    offers: {
      "@type": "Offer",
      price: displayPrice,
      priceCurrency: "NGN",
      availability: isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    aggregateRating:
      reviews.count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: reviews.avg,
            reviewCount: reviews.count,
          }
        : undefined,
  };

  return (
    <PageWrapper>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <ProductDetail product={product} reviews={reviews} />
      <RelatedProducts products={relatedProducts} />
    </PageWrapper>
  );
}
