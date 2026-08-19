export interface SanityCheckoutVariant {
  combinationKey?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  supplierSku?: string | null;
  supplierProductId?: string | null;
  available?: boolean | null;
}

export interface SanityCheckoutProduct {
  _id: string;
  title?: string | null;
  status?: string | null;
  hasVariants?: boolean | null;
  basePrice?: number | null;
  baseCompareAtPrice?: number | null;
  salePrice?: number | null;
  saleStartTime?: string | null;
  saleEndTime?: string | null;
  variants?: SanityCheckoutVariant[] | null;
}

export function isFlashSaleWindowActive(
  product: Pick<
    SanityCheckoutProduct,
    "salePrice" | "saleStartTime" | "saleEndTime"
  >,
  now = new Date()
) {
  return (
    product.salePrice != null &&
    product.saleStartTime != null &&
    product.saleEndTime != null &&
    new Date(product.saleStartTime) <= now &&
    now <= new Date(product.saleEndTime)
  );
}

// 18-FLASH-SALES.md's grace period ("honor the sale price if an order was
// created before saleEndTime") assumes an order can pre-date the price
// check. In this codebase order creation and price computation happen in
// the same POST /api/checkout call, so that condition can never hold —
// redefined (developer-confirmed) as a pure time-based window instead: any
// checkout priced within 5 minutes after saleEndTime still honors
// salePrice, protecting a buyer who was already mid-checkout when the sale
// ended without needing a client-supplied (spoofable) timestamp.
const CHECKOUT_GRACE_PERIOD_MS = 5 * 60 * 1000;

export function isWithinGracePeriod(
  product: Pick<SanityCheckoutProduct, "salePrice" | "saleStartTime" | "saleEndTime">,
  now = new Date()
) {
  if (product.salePrice == null || product.saleStartTime == null || product.saleEndTime == null) {
    return false;
  }

  const saleEnd = new Date(product.saleEndTime);
  const elapsedSinceSaleEnd = now.getTime() - saleEnd.getTime();

  return elapsedSinceSaleEnd > 0 && elapsedSinceSaleEnd <= CHECKOUT_GRACE_PERIOD_MS;
}

export function getActivePrice(
  product: SanityCheckoutProduct,
  combinationKey: string | null,
  now = new Date()
): number {
  const saleActive = isFlashSaleWindowActive(product, now) || isWithinGracePeriod(product, now);

  if (product.hasVariants && combinationKey) {
    const variant = product.variants?.find(
      (entry) => entry.combinationKey === combinationKey
    );

    if (!variant) {
      throw new Error(`Variant not found: ${combinationKey}`);
    }

    const variantPrice = variant.price ?? 0;
    return saleActive
      ? Math.min(product.salePrice ?? variantPrice, variantPrice)
      : variantPrice;
  }

  const basePrice = product.basePrice ?? 0;
  return saleActive ? Math.min(product.salePrice ?? basePrice, basePrice) : basePrice;
}

export function getCheckoutVariant(
  product: SanityCheckoutProduct,
  combinationKey: string | null
) {
  if (!product.hasVariants) {
    return null;
  }

  if (!combinationKey) {
    return null;
  }

  return (
    product.variants?.find((variant) => variant.combinationKey === combinationKey) ??
    null
  );
}
