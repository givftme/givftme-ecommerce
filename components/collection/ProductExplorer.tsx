"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Grid2X2, List, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useCart } from "@/components/cart/CartContext";
import { useToast } from "@/components/ui/Toast";
import {
  FilterSheet,
  FilterSidebar,
  type ProductFilters,
} from "@/components/collection/FilterSheet";
import { SortDropdown, type SortValue } from "@/components/collection/SortDropdown";
import { trackEvent } from "@/lib/analytics";
import { cn, formatPrice } from "@/lib/utils";
import type { ProductCardData } from "@/lib/sanity/types";

interface ProductExplorerProps {
  initialProducts: ProductCardData[];
  totalProducts: number;
  loadMoreEndpoint?: string;
  collectionSlug?: string;
}

function parsePrice(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortProducts(products: ProductCardData[], sort: SortValue) {
  const next = [...products];

  if (sort === "price-asc") {
    return next.sort(
      (a, b) =>
        (a.price ?? Number.MAX_SAFE_INTEGER) -
        (b.price ?? Number.MAX_SAFE_INTEGER)
    );
  }

  if (sort === "price-desc") {
    return next.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  }

  if (sort === "newest") {
    return next.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }

  return next;
}

export function ProductExplorer({
  initialProducts,
  totalProducts,
  loadMoreEndpoint,
  collectionSlug,
}: ProductExplorerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [filters, setFilters] = useState<ProductFilters>({
    minPrice: "",
    maxPrice: "",
    occasionTypes: [],
  });
  const [sort, setSort] = useState<SortValue>("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [pageSize, setPageSize] = useState(16);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { addItem } = useCart();
  const { toast } = useToast();

  const occasionTypes = useMemo(
    () =>
      Array.from(
        new Set(products.flatMap((product) => product.occasionTypes || []))
      ).filter(Boolean),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const min = parsePrice(filters.minPrice);
    const max = parsePrice(filters.maxPrice);

    const filtered = products.filter((product) => {
      if (typeof product.price === "number") {
        if (min !== null && product.price < min) {
          return false;
        }

        if (max !== null && product.price > max) {
          return false;
        }
      }

      if (filters.occasionTypes.length > 0) {
        return filters.occasionTypes.some((occasion) =>
          product.occasionTypes?.includes(occasion)
        );
      }

      return true;
    });

    return sortProducts(filtered, sort);
  }, [filters, products, sort]);
  const canLoadMore = Boolean(loadMoreEndpoint) && products.length < totalProducts;

  const clearFilters = () => {
    setFilters({ minPrice: "", maxPrice: "", occasionTypes: [] });
  };

  const loadMore = async () => {
    if (!loadMoreEndpoint) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = new URL(loadMoreEndpoint, window.location.origin);
      url.searchParams.set("offset", String(products.length));
      url.searchParams.set("limit", String(pageSize));
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Could not load more products.");
      }

      const payload = (await response.json()) as {
        products?: ProductCardData[];
        totalProducts?: number;
      };
      setProducts((current) => [...current, ...(payload.products || [])]);
      trackEvent("museum.load_more.clicked", {
        page: Math.ceil((products.length + (payload.products?.length || 0)) / pageSize),
        collection_slug: collectionSlug || null,
      });
    } catch {
      toast({
        title: "Couldn't load products. Try refreshing.",
        variant: "danger",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const addSimpleProductToCart = (product: ProductCardData) => {
    if (typeof product.price !== "number" || product.hasVariants) {
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
    toast({ title: "Added to cart ✓", variant: "success" });
  };

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      <FilterSidebar
        filters={filters}
        occasionTypes={occasionTypes}
        onChange={setFilters}
        onClear={clearFilters}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterOpen(true)}
            className="lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </Button>

          <p className="text-sm text-muted">
            Showing {filteredProducts.length === 0 ? 0 : 1}-{filteredProducts.length} of{" "}
            {totalProducts} results
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full border border-stone-200 bg-white p-1">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  viewMode === "grid" ? "bg-brand text-white" : "text-muted"
                )}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  viewMode === "list" ? "bg-brand text-white" : "text-muted"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-10 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value={16}>16</option>
                <option value={32}>32</option>
                <option value={48}>48</option>
              </select>
            </label>
            <SortDropdown
              value={sort}
              onChange={(value) => {
                setSort(value);
                trackEvent("museum.sort.changed", { sort_by: value });
              }}
            />
          </div>
        </div>

        {viewMode === "grid" ? (
          <CatalogProductGrid
            products={filteredProducts}
            emptyMessage="No products match those filters."
          />
        ) : filteredProducts.length > 0 ? (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link
                      href={`/product/${product.slug}`}
                      className="text-sm font-semibold text-ink transition-colors hover:text-brand"
                    >
                      {product.title}
                    </Link>
                    {product.subtitle ? (
                      <p className="mt-1 text-sm text-muted">{product.subtitle}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {typeof product.price === "number"
                        ? formatPrice(product.price)
                        : "Price not listed"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={product.hasVariants || typeof product.price !== "number"}
                    onClick={() => addSimpleProductToCart(product)}
                  >
                    {product.hasVariants ? "Choose options" : "Add to cart"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ProductGrid products={[]} emptyMessage="No products match those filters." />
        )}

        {canLoadMore ? (
          <div className="mt-10 flex justify-center">
            <Button type="button" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <FilterSheet
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        occasionTypes={occasionTypes}
        onChange={setFilters}
        onApply={() =>
          trackEvent("museum.filter.applied", {
            filter_type: "catalog",
            value: "mobile_sheet",
          })
        }
        onClear={clearFilters}
      />
    </div>
  );
}
