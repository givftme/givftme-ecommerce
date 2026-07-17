import { PageWrapper } from "@/components/layout/PageWrapper";
import { Hero } from "@/app/_components/home/Hero";
import { OccasionCategories, type OccasionCategory } from "@/app/_components/home/OccasionCategories";
import { ProductSection } from "@/app/_components/home/ProductSection";
import type { ProductCardData } from "@/components/product/ProductCard";

// Placeholder content until the Sanity catalog client and GROQ queries
// (lib/sanity/queries.ts, per ROADMAP.md "Not started") are wired up.
const occasions: OccasionCategory[] = [
  { slug: "birthdays", name: "Birthdays", itemCount: 32 },
  { slug: "weddings", name: "Weddings", itemCount: 21 },
  { slug: "anniversaries", name: "Anniversaries", itemCount: 17 },
  { slug: "baby-showers", name: "Baby Showers", itemCount: 14 },
  { slug: "graduations", name: "Graduations", itemCount: 19 },
  { slug: "housewarmings", name: "Housewarmings", itemCount: 12 },
];

const recommendedProducts: ProductCardData[] = [
  {
    id: "rec-1",
    slug: "aurora-scented-candle-set",
    title: "Aurora Candle Set",
    subtitle: "Hand-poured scented candles",
    price: 12500,
    compareAtPrice: 17800,
  },
  {
    id: "rec-2",
    slug: "heritage-leather-weekender",
    title: "Heritage Weekender",
    subtitle: "Full-grain leather travel bag",
    price: 68000,
  },
  {
    id: "rec-3",
    slug: "rosegold-classic-watch",
    title: "Rosegold Classic Watch",
    subtitle: "Stainless steel, sapphire glass",
    price: 45000,
    compareAtPrice: 90000,
  },
  {
    id: "rec-4",
    slug: "woven-picnic-basket",
    title: "Woven Picnic Basket",
    subtitle: "Outdoor dining essentials",
    price: 21000,
    isNew: true,
  },
];

const featuredProducts: ProductCardData[] = [
  {
    id: "feat-1",
    slug: "aurora-scented-candle-set",
    title: "Aurora Candle Set",
    subtitle: "Hand-poured scented candles",
    price: 12500,
    compareAtPrice: 17800,
  },
  {
    id: "feat-2",
    slug: "heritage-leather-weekender",
    title: "Heritage Weekender",
    subtitle: "Full-grain leather travel bag",
    price: 68000,
  },
  {
    id: "feat-3",
    slug: "rosegold-classic-watch",
    title: "Rosegold Classic Watch",
    subtitle: "Stainless steel, sapphire glass",
    price: 45000,
    compareAtPrice: 90000,
  },
  {
    id: "feat-4",
    slug: "woven-picnic-basket",
    title: "Woven Picnic Basket",
    subtitle: "Outdoor dining essentials",
    price: 21000,
  },
  {
    id: "feat-5",
    slug: "wireless-earbuds-pro",
    title: "Wireless Earbuds Pro",
    subtitle: "Noise-cancelling, 30hr battery",
    price: 32000,
  },
  {
    id: "feat-6",
    slug: "ceramic-mug-gift-set",
    title: "Ceramic Mug Set",
    subtitle: "Set of two, hand-glazed",
    price: 9500,
  },
  {
    id: "feat-7",
    slug: "curated-gift-hamper",
    title: "Curated Gift Hamper",
    subtitle: "Snacks, treats & a keepsake box",
    price: 27500,
    compareAtPrice: 35000,
  },
  {
    id: "feat-8",
    slug: "terrazzo-planter-pot",
    title: "Terrazzo Planter Pot",
    subtitle: "Minimalist ceramic planter",
    price: 8500,
  },
];

export default function Page() {
  return (
    <PageWrapper>
      <Hero />
      <OccasionCategories occasions={occasions} />
      <ProductSection
        title="Recommendations"
        tabs={["Best Seller", "On sale", "New Arrivals", "Top Rated"]}
        products={recommendedProducts}
        showBadges
      />
      <ProductSection
        title="Featured Products"
        tabs={["Tech Accessories", "All", "Givft Box", "Corporate Gift"]}
        products={featuredProducts}
        showWishlist
        showMoreHref="/shop"
        className="bg-surface"
      />
    </PageWrapper>
  );
}
