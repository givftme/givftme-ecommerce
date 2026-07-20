import Link from "next/link";
import { Zap } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProductExplorer } from "@/components/collection/ProductExplorer";
import { TrackView } from "@/components/shared/TrackView";
import { normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import {
  FLASH_SALE_PRODUCTS_QUERY,
  SHOP_PRODUCTS_COUNT_QUERY,
  SHOP_PRODUCTS_QUERY,
} from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

export const revalidate = 60;

export default async function ShopPage() {
  const now = new Date().toISOString();
  const [rawProducts, totalProducts, flashSaleProducts] = await Promise.all([
    sanityFetch<ProductCardData[]>(SHOP_PRODUCTS_QUERY, { offset: 0, limit: 16 }),
    sanityFetch<number>(SHOP_PRODUCTS_COUNT_QUERY),
    sanityFetch<ProductCardData[]>(FLASH_SALE_PRODUCTS_QUERY, { now, limit: 1 }),
  ]);
  const products = normalizeProductCards(rawProducts);
  const hasFlashSale = flashSaleProducts.length > 0;

  return (
    <PageWrapper>
      <TrackView event="museum.shop.viewed" properties={{ product_count: totalProducts }} />
      {hasFlashSale ? (
        <Link
          href="/flash-sale"
          className="block bg-brand-light text-brand transition-colors hover:bg-surface"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm font-semibold lg:px-8">
            <Zap className="h-4 w-4" fill="currentColor" />
            Flash sale is live - shop marked-down gifts
          </div>
        </Link>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <header className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-ink lg:text-4xl">Shop</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Browse every active catalog gift across the Gifvtme museum.
          </p>
        </header>

        <ProductExplorer
          initialProducts={products}
          totalProducts={totalProducts}
          loadMoreEndpoint="/api/shop/products"
        />
      </section>
    </PageWrapper>
  );
}
