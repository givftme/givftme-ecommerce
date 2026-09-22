import { NextRequest, NextResponse } from "next/server";
import { loadMuseumProducts } from "@/lib/gift-museum/shop";

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
  const { products, totalProducts } = await loadMuseumProducts(offset, limit);

  return NextResponse.json({
    products,
    totalProducts,
  });
}
