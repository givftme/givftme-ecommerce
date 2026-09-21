import {
  getActivePrice,
  getCheckoutVariant,
  type SanityCheckoutProduct,
} from "@/lib/flutterwave/getActivePrice";
import { sanityFetch } from "@/lib/sanity/fetch";
import { CART_PRICES_QUERY } from "@/lib/sanity/queries";

export interface GiftCatalogProduct extends SanityCheckoutProduct {
  images?: Array<{ url?: string | null; alt?: string | null }> | null;
  supplier?: { _id?: string | null; name?: string | null } | null;
  supplierProductId?: string | null;
}

export interface ResolvedGiftProduct {
  product: GiftCatalogProduct;
  unit_price: number;
  product_title: string;
  product_image_url: string | null;
  supplier_id: string | null;
  supplier_product_id: string | null;
}

/**
 * The single place a gift's price comes from.
 *
 * Both the gift checkout page and its context endpoint resolve through
 * here so they cannot drift: the price a buyer is shown and the price the
 * order is created at are computed by the same call against the same
 * Sanity read. Nothing here ever accepts a price from a caller.
 */
export async function resolveGiftProduct(
  catalogProductId: string,
  combinationKey: string | null
): Promise<ResolvedGiftProduct | null> {
  let products: GiftCatalogProduct[] = [];

  try {
    products = await sanityFetch<GiftCatalogProduct[]>(CART_PRICES_QUERY, {
      ids: [catalogProductId],
    });
  } catch (error) {
    console.error("Failed to resolve gift product", error);
    return null;
  }

  const product = products?.[0] ?? null;

  if (!product || product.status !== "active") {
    return null;
  }

  const variant = getCheckoutVariant(product, combinationKey);

  if (product.hasVariants && (!variant || variant.available === false)) {
    return null;
  }

  let unitPrice: number;

  try {
    unitPrice = getActivePrice(product, combinationKey);
  } catch {
    return null;
  }

  if (unitPrice <= 0) {
    return null;
  }

  return {
    product,
    unit_price: unitPrice,
    product_title: product.title || "Untitled gift",
    product_image_url: product.images?.[0]?.url || null,
    supplier_id: product.supplier?._id || null,
    supplier_product_id: variant?.supplierProductId || product.supplierProductId || null,
  };
}
