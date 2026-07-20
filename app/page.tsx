import { PageWrapper } from "@/components/layout/PageWrapper";
import { FlashSaleBanner } from "@/components/flash-sale/FlashSaleBanner";
import { Hero } from "@/app/_components/home/Hero";
import { OccasionCategories, type OccasionCategory } from "@/app/_components/home/OccasionCategories";
import { ProductSection } from "@/app/_components/home/ProductSection";
import { TrustBadges } from "@/app/_components/home/TrustBadges";
import { NewsletterSignup } from "@/components/shared/NewsletterSignup";
import { TrackView } from "@/components/shared/TrackView";
import {
  normalizeOccasion,
  normalizeProductCards,
} from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import {
  FEATURED_PRODUCTS_QUERY,
  FLASH_SALE_PRODUCTS_QUERY,
  NEW_PRODUCTS_QUERY,
  OCCASIONS_QUERY,
} from "@/lib/sanity/queries";
import type { MuseumOccasion, ProductCardData } from "@/lib/sanity/types";

export const revalidate = 60;

export default async function Page() {
  const now = new Date().toISOString();
  const [rawOccasions, rawFeatured, rawSale, rawNew] = await Promise.all([
    sanityFetch<Partial<MuseumOccasion>[]>(OCCASIONS_QUERY),
    sanityFetch<ProductCardData[]>(FEATURED_PRODUCTS_QUERY, { limit: 8 }),
    sanityFetch<ProductCardData[]>(FLASH_SALE_PRODUCTS_QUERY, { now, limit: 8 }),
    sanityFetch<ProductCardData[]>(NEW_PRODUCTS_QUERY, { limit: 8 }),
  ]);
  const occasions: OccasionCategory[] = rawOccasions
    .map(normalizeOccasion)
    .filter((occasion) => occasion.id)
    .slice(0, 6)
    .map((occasion) => ({
      slug: occasion.slug,
      title: occasion.title,
      itemCount: occasion.itemCount,
      coverImageUrl: occasion.coverImageUrl,
      emoji: occasion.emoji,
    }));
  const featuredProducts = normalizeProductCards(rawFeatured);
  const saleProducts = normalizeProductCards(rawSale);
  const newProducts = normalizeProductCards(rawNew);
  const productTabs = ["Best Seller", "On sale", "New Arrivals", "Top Rated"];
  const productsByTab = {
    "Best Seller": featuredProducts,
    "On sale": saleProducts,
    "New Arrivals": newProducts,
    "Top Rated": featuredProducts,
  };

  return (
    <PageWrapper>
      <TrackView event="museum.home.viewed" properties={{}} />
      <FlashSaleBanner saleEndTime={saleProducts[0]?.saleEndTime} />
      <Hero />
      <OccasionCategories occasions={occasions} />
      <ProductSection
        title="Featured gifts"
        tabs={productTabs}
        products={featuredProducts}
        productsByTab={productsByTab}
        showBadges
        showMoreHref="/shop"
      />
      <TrustBadges />
      <NewsletterSignup />
    </PageWrapper>
  );
}
