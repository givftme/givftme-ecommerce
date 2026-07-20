import { NextRequest, NextResponse } from "next/server";
import { normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import {
  CART_FALLBACK_RECOMMENDATIONS_QUERY,
  CART_PRICES_QUERY,
  CART_RECOMMENDATIONS_QUERY,
} from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

interface CartPriceProduct {
  _id: string;
  collectionIds?: string[];
}

function parseIds(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ).slice(0, 50);
}

function mergeRecommendationBatches(
  primary: ProductCardData[],
  fallback: ProductCardData[],
  limit: number
) {
  const seen = new Set<string>();
  const merged: ProductCardData[] = [];

  for (const product of [...primary, ...fallback]) {
    if (!product.id || seen.has(product.id)) {
      continue;
    }

    seen.add(product.id);
    merged.push(product);

    if (merged.length === limit) {
      break;
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));

  if (ids.length === 0) {
    return NextResponse.json({ products: [], recommended_products: [] });
  }

  const products = await sanityFetch<CartPriceProduct[]>(CART_PRICES_QUERY, {
    ids,
  });
  const collectionIds = Array.from(
    new Set(products.flatMap((product) => product.collectionIds || []))
  );
  const limit = 4;
  const recommendationParams = {
    excludeIds: ids,
    collectionIds,
    limit,
  };
  const [primaryRecommendations, fallbackRecommendations] = await Promise.all([
    collectionIds.length > 0
      ? sanityFetch<ProductCardData[]>(
          CART_RECOMMENDATIONS_QUERY,
          recommendationParams
        )
      : Promise.resolve([]),
    sanityFetch<ProductCardData[]>(CART_FALLBACK_RECOMMENDATIONS_QUERY, {
      excludeIds: ids,
      limit,
    }),
  ]);

  return NextResponse.json({
    products,
    recommended_products: mergeRecommendationBatches(
      normalizeProductCards(primaryRecommendations),
      normalizeProductCards(fallbackRecommendations),
      limit
    ),
  });
}
