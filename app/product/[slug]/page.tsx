import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ExternalGiftDetail } from "@/components/product/ExternalGiftDetail";
import { ProductDetail } from "@/components/product/ProductDetail";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import {
  candidateToProductCard,
  getPublishedExternalCandidateBySlug,
} from "@/lib/gift-museum/candidates";
import {
  normalizeProductCards,
  normalizeProductFull,
  portableTextToPlainText,
} from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { PRODUCT_PAGE_QUERY, RELATED_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProductReviewsSummary } from "@/lib/reviews/server";
import type { ProductCardData, ProductFullData } from "@/lib/sanity/types";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import { sanityOgImage } from "@/lib/seo/sanity";

export const revalidate = 60;

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

const PRODUCT_FALLBACK_DESCRIPTION =
  "Discover this gift on Givftme — add it to your wishlist or send it to someone you love.";

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = `/product/${slug}`;
  const rawProduct = await sanityFetch<ProductFullData | null>(
    PRODUCT_PAGE_QUERY,
    { slug }
  );

  if (!rawProduct) {
    const candidate = await getPublishedExternalCandidateBySlug(
      createServiceClient(),
      slug
    );

    if (!candidate) {
      return { title: "Gift not found", robots: { index: false } };
    }

    const product = candidateToProductCard(candidate);
    return buildPageMetadata({
      title: product.title,
      description: product.subtitle
        ? truncateDescription(`${product.title} from ${product.subtitle}, on Givftme.`)
        : PRODUCT_FALLBACK_DESCRIPTION,
      path,
      image: product.imageUrl?.startsWith("https://")
        ? { url: product.imageUrl, alt: product.title }
        : undefined,
      });
  }

  const product = normalizeProductFull(rawProduct);
  const description =
    portableTextToPlainText(product.description) ||
    product.shortDescription ||
    PRODUCT_FALLBACK_DESCRIPTION;

  return buildPageMetadata({
    title: product.title.trim(),
    description: truncateDescription(description),
    path,
    image: sanityOgImage(product.images[0]?.url, product.title),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const rawProduct = await sanityFetch<ProductFullData | null>(
    PRODUCT_PAGE_QUERY,
    { slug }
  );

  if (!rawProduct) {
    const candidate = await getPublishedExternalCandidateBySlug(
      createServiceClient(),
      slug
    );

    if (!candidate) {
      notFound();
    }

    return (
      <PageWrapper>
        <ExternalGiftDetail product={candidateToProductCard(candidate)} />
      </PageWrapper>
    );
  }

  const product = normalizeProductFull(rawProduct);
  const collectionIds = product.collections.map((collection) => collection.id);
  const supabase = await createClient();
  const [reviews, relatedRaw, currentUser] = await Promise.all([
    getProductReviewsSummary(supabase, product.catalogProductId),
    collectionIds.length > 0
      ? sanityFetch<ProductCardData[]>(RELATED_PRODUCTS_QUERY, {
          productId: product.catalogProductId,
          collectionIds,
        })
      : Promise.resolve([]),
    supabase.auth.getUser(),
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
      <ProductDetail
        product={product}
        reviews={reviews}
        currentUserId={currentUser.data.user?.id || null}
      />
      <RelatedProducts products={relatedProducts} />
    </PageWrapper>
  );
}
