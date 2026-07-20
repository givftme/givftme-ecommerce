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

export function getActivePrice(
  product: SanityCheckoutProduct,
  combinationKey: string | null
): number {
  const saleActive = isFlashSaleWindowActive(product);

  if (product.hasVariants && combinationKey) {
    const variant = product.variants?.find(
      (entry) => entry.combinationKey === combinationKey
    );

    if (!variant) {
      throw new Error(`Variant not found: ${combinationKey}`);
    }

    return saleActive ? (product.salePrice ?? variant.price ?? 0) : variant.price ?? 0;
  }

  return saleActive
    ? product.salePrice ?? product.basePrice ?? 0
    : product.basePrice ?? 0;
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
