"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { useCart, type CartItem as CartLine } from "@/components/cart/CartContext";
import { useCartPriceRefresh } from "@/components/cart/useCartPriceRefresh";
import { ProductGrid } from "@/components/product/ProductGrid";
import { trackEvent } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";
import { withRedirect } from "@/lib/auth/redirect";
import type { ProductCardData } from "@/lib/sanity/types";

const recommendationFilters = [
  "Best Seller",
  "On sale",
  "New Arrivals",
  "Top Rated",
] as const;

type RecommendationFilter = (typeof recommendationFilters)[number];

interface CartPageClientProps {
  isAuthenticated: boolean;
}

function filterRecommendations(
  products: ProductCardData[],
  filter: RecommendationFilter
) {
  if (filter === "On sale") {
    const saleProducts = products.filter((product) => product.isOnFlashSale);
    return saleProducts.length > 0 ? saleProducts : products;
  }

  if (filter === "New Arrivals") {
    const newProducts = products.filter((product) => product.isNew);
    return newProducts.length > 0 ? newProducts : products;
  }

  return products;
}

export function CartPageClient({ isAuthenticated }: CartPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { addItem, items, removeItem, updateQuantity, totalPrice } = useCart();
  const {
    recommendedProducts,
    unavailableItems,
    priceNotice,
    isRefreshingPrices,
  } = useCartPriceRefresh();
  const [activeFilter, setActiveFilter] =
    useState<RecommendationFilter>("Best Seller");
  const unavailableByLine = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of unavailableItems) {
      map.set(
        `${item.catalog_product_id}-${item.combination_key || "base"}`,
        item.reason
      );
    }

    return map;
  }, [unavailableItems]);
  const visibleRecommendations = filterRecommendations(
    recommendedProducts,
    activeFilter
  );
  const hasUnavailableItems = unavailableItems.length > 0;

  useEffect(() => {
    trackEvent("cart.viewed", {
      item_count: items.length,
      total_value: totalPrice,
    });
  }, [items.length, totalPrice]);

  useEffect(() => {
    if (priceNotice) {
      trackEvent("cart.prices_refreshed", {
        items_with_price_changes: 1,
      });
    }
  }, [priceNotice]);

  const handleQuantityChange = (item: CartLine, quantity: number) => {
    trackEvent("cart.quantity_changed", {
      product_id: item.catalog_product_id,
      old_qty: item.quantity,
      new_qty: quantity,
    });
    updateQuantity(item.catalog_product_id, item.combination_key, quantity);
  };

  const handleRemove = (item: CartLine) => {
    trackEvent("cart.item_removed", { product_id: item.catalog_product_id });
    removeItem(item.catalog_product_id, item.combination_key);
    toast({ title: "Removed from cart." });
  };

  const handleRecommendedCart = (product: ProductCardData) => {
    if (product.hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }

    if (typeof product.price !== "number") {
      toast({ title: "This gift needs a current price first.", variant: "danger" });
      return;
    }

    addItem({
      catalog_product_id: product.catalogProductId,
      product_title: product.title,
      product_image_url: product.imageUrl || null,
      combination_key: null,
      selected_options: {},
      quantity: 1,
      unit_price: product.price,
      supplier_product_id: product.supplierProductId || null,
    });
    toast({ title: "Added to cart.", variant: "success" });
  };

  if (items.length === 0) {
    return <EmptyCart isAuthenticated={isAuthenticated} />;
  }

  return (
    <section className="bg-surface pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <header className="relative flex items-center justify-center md:hidden">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.back()}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-center text-xl font-bold text-ink">Cart</h1>
          <Link
            href="/shop"
            aria-label="Browse shop"
            className="absolute right-0 flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <Menu className="h-5 w-5" />
          </Link>
        </header>

        <div className="hidden md:block">
          <h1 className="text-3xl font-bold text-ink">Cart</h1>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-ink">Cart Summary</h2>
                {isRefreshingPrices ? (
                  <p className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating prices
                  </p>
                ) : null}
              </div>

              {priceNotice ? (
                <p className="mt-3 rounded-xl bg-brand-light px-4 py-3 text-sm font-medium text-brand">
                  {priceNotice}
                </p>
              ) : null}

              {hasUnavailableItems ? (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  Remove unavailable items before checkout.
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {items.map((item) => {
                const lineKey = `${item.catalog_product_id}-${
                  item.combination_key || "base"
                }`;

                return (
                  <CartItem
                    key={lineKey}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                    unavailableReason={unavailableByLine.get(lineKey)}
                  />
                );
              })}
            </div>

            <section className="pt-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-ink">
                  Recommended for you
                </h2>
              </div>
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                {recommendationFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      activeFilter === filter
                        ? "bg-brand text-white"
                        : "bg-white text-muted hover:bg-brand-light hover:text-brand"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <ProductGrid
                products={visibleRecommendations}
                onAddToCart={handleRecommendedCart}
                emptyMessage="Recommended gifts will appear once catalog items are in your cart."
              />
            </section>
          </div>

          <div className="hidden lg:block">
            <CartSummary
              items={items}
              total={totalPrice}
              isAuthenticated={isAuthenticated}
              disabled={hasUnavailableItems}
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-stone-100 bg-white p-4 shadow-lg md:hidden">
        <Button
          type="button"
          fullWidth
          disabled={hasUnavailableItems}
          onClick={() =>
            router.push(
              isAuthenticated
                ? "/checkout"
                : withRedirect("/login", "/checkout")
            )
          }
        >
          {isAuthenticated
            ? `Checkout ${formatPrice(totalPrice)}`
            : "Sign in to checkout"}
        </Button>
      </div>
    </section>
  );
}
