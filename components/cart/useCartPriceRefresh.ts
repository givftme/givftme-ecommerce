"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart, type CartItem } from "@/components/cart/CartContext";
import {
  getActivePrice,
  getCheckoutVariant,
  isFlashSaleWindowActive,
  type SanityCheckoutProduct,
} from "@/lib/flutterwave/getActivePrice";
import type { ProductCardData } from "@/lib/sanity/types";

interface CartPriceProduct extends SanityCheckoutProduct {
  images?: Array<{ url?: string | null; alt?: string | null }> | null;
  imageUrl?: string | null;
  supplierProductId?: string | null;
}

export interface UnavailableCartItem {
  catalog_product_id: string;
  combination_key: string | null;
  title: string;
  reason: string;
}

interface CartPricesResponse {
  products?: CartPriceProduct[];
  recommended_products?: ProductCardData[];
}

function getLineUnavailableReason(line: CartItem, product: CartPriceProduct | null) {
  if (!product) {
    return "Product is no longer available";
  }

  if (product.status !== "active") {
    return "Product is no longer active";
  }

  if (product.hasVariants) {
    const variant = getCheckoutVariant(product, line.combination_key);

    if (!variant) {
      return "Variant is no longer available";
    }

    if (variant.available === false) {
      return "Variant is sold out";
    }
  }

  return "";
}

function getProductImageUrl(product: CartPriceProduct) {
  return product.images?.[0]?.url || product.imageUrl || null;
}

function hasSaleJustEnded(line: CartItem, product: CartPriceProduct) {
  return (
    product.salePrice != null &&
    product.saleEndTime != null &&
    !isFlashSaleWindowActive(product) &&
    line.unit_price !== getActivePrice(product, line.combination_key)
  );
}

export function useCartPriceRefresh() {
  const { items, updateItemDetails } = useCart();
  const [recommendedProducts, setRecommendedProducts] = useState<ProductCardData[]>(
    []
  );
  const [unavailableItems, setUnavailableItems] = useState<UnavailableCartItem[]>(
    []
  );
  const [priceNotice, setPriceNotice] = useState("");
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const cartProductIds = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.catalog_product_id))).filter(
        Boolean
      ),
    [items]
  );

  useEffect(() => {
    if (cartProductIds.length === 0) {
      return;
    }

    const controller = new AbortController();
    const loadingTimeout = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setIsRefreshingPrices(true);
      }
    }, 0);

    fetch(`/api/cart/prices?ids=${cartProductIds.join(",")}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not refresh cart prices.");
        }

        return (await response.json()) as CartPricesResponse;
      })
      .then((payload) => {
        const products = payload.products || [];
        const byId = new Map(products.map((product) => [product._id, product]));
        const nextUnavailable: UnavailableCartItem[] = [];
        const changedTitles: string[] = [];
        const saleEndedTitles: string[] = [];

        for (const line of items) {
          const product = byId.get(line.catalog_product_id) ?? null;
          const unavailableReason = getLineUnavailableReason(line, product);

          if (unavailableReason) {
            nextUnavailable.push({
              catalog_product_id: line.catalog_product_id,
              combination_key: line.combination_key,
              title: product?.title || line.product_title,
              reason: unavailableReason,
            });
            continue;
          }

          if (!product) {
            continue;
          }

          const variant = getCheckoutVariant(product, line.combination_key);
          const nextPrice = getActivePrice(product, line.combination_key);
          const nextImageUrl = getProductImageUrl(product);
          const nextSupplierProductId =
            variant?.supplierProductId || product.supplierProductId || null;
          const details = {
            product_title: product.title || line.product_title,
            product_image_url: nextImageUrl,
            unit_price: nextPrice,
            supplier_product_id: nextSupplierProductId,
          };
          const changed =
            details.product_title !== line.product_title ||
            details.product_image_url !== line.product_image_url ||
            details.unit_price !== line.unit_price ||
            details.supplier_product_id !== line.supplier_product_id;

          if (changed) {
            updateItemDetails(line.catalog_product_id, line.combination_key, details);
          }

          if (nextPrice !== line.unit_price) {
            changedTitles.push(product.title || line.product_title);

            if (hasSaleJustEnded(line, product)) {
              saleEndedTitles.push(product.title || line.product_title);
            }
          }
        }

        setUnavailableItems(nextUnavailable);
        setRecommendedProducts(payload.recommended_products || []);

        if (saleEndedTitles.length > 0) {
          setPriceNotice(
            `The flash sale for ${saleEndedTitles[0]} ended - current prices have been applied.`
          );
        } else if (changedTitles.length > 0) {
          setPriceNotice(
            `${changedTitles.length} ${changedTitles.length === 1 ? "price has" : "prices have"} been updated.`
          );
        }
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          console.error("Cart price refresh failed.", error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRefreshingPrices(false);
        }
      });

    return () => {
      window.clearTimeout(loadingTimeout);
      controller.abort();
    };
  }, [cartProductIds, items, updateItemDetails]);

  return {
    recommendedProducts: cartProductIds.length > 0 ? recommendedProducts : [],
    unavailableItems: cartProductIds.length > 0 ? unavailableItems : [],
    priceNotice: cartProductIds.length > 0 ? priceNotice : "",
    isRefreshingPrices: cartProductIds.length > 0 ? isRefreshingPrices : false,
  };
}
