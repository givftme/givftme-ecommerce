import Link from "next/link";
import { Zap } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FlashSaleTimer } from "@/components/flash-sale/FlashSaleTimer";
import { ProductExplorer } from "@/components/collection/ProductExplorer";
import { buttonVariants } from "@/components/ui/Button";
import { TrackView } from "@/components/shared/TrackView";
import { getMaxFlashSaleDiscountPercent, normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { FLASH_SALE_PRODUCTS_COUNT_QUERY, FLASH_SALE_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

// Shorter than the standard 60s elsewhere — flash sale prices/availability
// change fast enough that a fresher list matters more here.
export const revalidate = 30;

export default async function FlashSalePage() {
  const now = new Date().toISOString();
  const [rawProducts, totalProducts] = await Promise.all([
    sanityFetch<ProductCardData[]>(FLASH_SALE_PRODUCTS_QUERY, { now, offset: 0, limit: 48 }),
    sanityFetch<number>(FLASH_SALE_PRODUCTS_COUNT_QUERY, { now }),
  ]);
  const products = normalizeProductCards(rawProducts);
  const soonestEndingSale = products[0]?.saleEndTime ?? null;
  const maxDiscountPercent = getMaxFlashSaleDiscountPercent(products);

  return (
    <PageWrapper>
      <TrackView
        event="museum.flash_sale.page_viewed"
        properties={{ active_product_count: totalProducts }}
      />

      <section className="bg-brand text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center lg:px-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand">
            <Zap className="h-6 w-6" fill="currentColor" />
          </span>
          <h1 className="mt-4 text-3xl font-bold lg:text-4xl">⚡ Flash Sale</h1>
          {soonestEndingSale ? (
            <p className="mt-3 text-lg font-semibold sm:text-xl">
              {maxDiscountPercent ? `Up to ${maxDiscountPercent}% off · ` : null}
              Offers end in{" "}
              <FlashSaleTimer
                endTime={soonestEndingSale}
                className="inline-block text-2xl font-bold text-white sm:text-3xl"
                disableUrgencyColor
              />
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        {products.length > 0 ? (
          <ProductExplorer
            initialProducts={products}
            totalProducts={totalProducts}
            loadMoreEndpoint="/api/flash-sale/products"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg font-medium text-ink">
              No flash sales right now. Check back soon!
            </p>
            <Link href="/shop" className={buttonVariants({ variant: "filled" })}>
              Browse the catalog
            </Link>
          </div>
        )}
      </section>
    </PageWrapper>
  );
}
