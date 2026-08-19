import { NextRequest, NextResponse } from "next/server";
import { normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { FLASH_SALE_PRODUCTS_COUNT_QUERY, FLASH_SALE_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0);
  const limit = Math.min(
    48,
    parsePositiveInt(request.nextUrl.searchParams.get("limit"), 16)
  );
  const now = new Date().toISOString();
  const [products, totalProducts] = await Promise.all([
    sanityFetch<ProductCardData[]>(FLASH_SALE_PRODUCTS_QUERY, { now, offset, limit }),
    sanityFetch<number>(FLASH_SALE_PRODUCTS_COUNT_QUERY, { now }),
  ]);

  return NextResponse.json({
    products: normalizeProductCards(products),
    totalProducts,
  });
}
