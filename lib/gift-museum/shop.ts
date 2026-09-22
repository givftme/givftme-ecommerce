import { listPublishedExternalCandidateProducts, countPublishedExternalCandidates } from "@/lib/gift-museum/candidates";
import { normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { SHOP_PRODUCTS_COUNT_QUERY, SHOP_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import { createServiceClient } from "@/lib/supabase/server";
import type { ProductCardData } from "@/lib/sanity/types";

export async function loadMuseumProducts(offset: number, limit: number) {
  const serviceSupabase = createServiceClient();
  const [externalCount, catalogCount] = await Promise.all([
    countPublishedExternalCandidates(serviceSupabase),
    sanityFetch<number>(SHOP_PRODUCTS_COUNT_QUERY),
  ]);
  const externalOffset = Math.min(offset, externalCount);
  const externalLimit = Math.min(limit, Math.max(0, externalCount - externalOffset));
  const catalogOffset = Math.max(0, offset - externalCount);
  const catalogLimit = limit - externalLimit;
  const [externalProducts, rawCatalogProducts] = await Promise.all([
    externalLimit > 0
      ? listPublishedExternalCandidateProducts(
          serviceSupabase,
          externalLimit,
          externalOffset
        )
      : Promise.resolve([]),
    catalogLimit > 0
      ? sanityFetch<ProductCardData[]>(SHOP_PRODUCTS_QUERY, {
          offset: catalogOffset,
          limit: catalogLimit,
        })
      : Promise.resolve([]),
  ]);

  return {
    products: [...externalProducts, ...normalizeProductCards(rawCatalogProducts)],
    totalProducts: externalCount + catalogCount,
  };
}
