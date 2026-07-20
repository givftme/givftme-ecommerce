"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import type { ProductCardData } from "@/lib/sanity/types";

export interface ProductSectionProps {
  title: string;
  tabs: string[];
  products: ProductCardData[];
  productsByTab?: Record<string, ProductCardData[]>;
  showBadges?: boolean;
  showWishlist?: boolean;
  showMoreHref?: string;
  className?: string;
}

export function ProductSection({
  title,
  tabs,
  products,
  productsByTab,
  showBadges,
  showMoreHref,
  className,
}: ProductSectionProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const activeProducts = productsByTab?.[activeTab] || products;

  return (
    <section className={cn("py-14", className)}>
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-ink">{title}</h2>
          <ul className="flex flex-wrap items-center gap-6 text-sm">
            {tabs.map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "transition-colors",
                    tab === activeTab ? "font-medium text-brand" : "text-muted hover:text-ink"
                  )}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <CatalogProductGrid
            products={activeProducts}
            showBadges={showBadges}
          />
        </div>

        {showMoreHref && (
          <div className="mt-10 flex justify-center">
            <Link
              href={showMoreHref}
              className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
            >
              Show more
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
