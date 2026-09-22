import { PageWrapper } from "@/components/layout/PageWrapper";
import { FlashSaleBanner } from "@/components/flash-sale/FlashSaleBanner";
import { Hero } from "@/app/_components/home/Hero";
import { OccasionCategories, type OccasionCategory } from "@/app/_components/home/OccasionCategories";
import { TrustBadges } from "@/app/_components/home/TrustBadges";
import { NewsletterSignup } from "@/components/shared/NewsletterSignup";
import { TrackView } from "@/components/shared/TrackView";
import {
  getMaxFlashSaleDiscountPercent,
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
import Marquees from "@/app/_components/home/Marquees";
import Pillars from "./_components/home/Pillars";
import Reminders from "./_components/home/Reminders";
import { FeedbackProvider } from "@/hooks/useFeedback";
import Wishlist from "./_components/home/Wishlist";
import Museum from "./_components/home/Museum";
import Pool from "./_components/home/Pool";

export const revalidate = 60;

export default async function Page() {
  const now = new Date().toISOString();
  const [rawOccasions, rawFeatured, rawSale, rawNew] = await Promise.all([
    sanityFetch<Partial<MuseumOccasion>[]>(OCCASIONS_QUERY),
    sanityFetch<ProductCardData[]>(FEATURED_PRODUCTS_QUERY, { limit: 8 }),
    sanityFetch<ProductCardData[]>(FLASH_SALE_PRODUCTS_QUERY, { now, offset: 0, limit: 8 }),
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

  return (
    <PageWrapper>
      <TrackView event="museum.home.viewed" properties={{}} />
      <FlashSaleBanner
        saleEndTime={saleProducts[0]?.saleEndTime}
        maxDiscountPercent={getMaxFlashSaleDiscountPercent(saleProducts)}
      />
      <FeedbackProvider>
        <Hero />
        <Marquees />
        <OccasionCategories occasions={occasions} />
        <Pillars />
        <Reminders />
        <Wishlist />
        <Museum products={(featuredProducts.length ? featuredProducts : newProducts).slice(0, 4)} />
        <Pool />
        <TrustBadges />
        <NewsletterSignup />
      </FeedbackProvider>
    </PageWrapper>
  );
}
