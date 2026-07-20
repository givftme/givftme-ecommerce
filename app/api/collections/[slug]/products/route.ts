import { NextRequest, NextResponse } from "next/server";
import { normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { COLLECTION_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

interface CollectionProductsRouteContext {
  params: Promise<{ slug: string }>;
}

interface CollectionProductsPayload {
  totalProducts?: number;
  products?: ProductCardData[];
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
  context: CollectionProductsRouteContext
) {
  const { slug } = await context.params;
  const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0);
  const limit = Math.min(
    48,
    parsePositiveInt(request.nextUrl.searchParams.get("limit"), 12)
  );

  const payload = await sanityFetch<CollectionProductsPayload | null>(
    COLLECTION_PRODUCTS_QUERY,
    { slug, offset, limit }
  );

  if (!payload) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  return NextResponse.json({
    products: normalizeProductCards(payload.products || []),
    totalProducts: payload.totalProducts || 0,
  });
}
