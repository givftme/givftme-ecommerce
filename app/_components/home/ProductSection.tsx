"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AuthPromptSheet } from "@/components/auth/AuthPromptSheet";
import { cn } from "@/lib/utils";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardData } from "@/components/product/ProductCard";
import { createClient } from "@/lib/supabase/client";

export interface ProductSectionProps {
  title: string;
  tabs: string[];
  products: ProductCardData[];
  showBadges?: boolean;
  showWishlist?: boolean;
  showMoreHref?: string;
  className?: string;
}

export function ProductSection({
  title,
  tabs,
  products,
  showBadges,
  showWishlist,
  showMoreHref,
  className,
}: ProductSectionProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);

  useEffect(() => {
    if (!showWishlist) {
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setIsAuthenticated(Boolean(data.user));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [showWishlist]);

  const toggleWishlist = (id: string) => {
    if (!isAuthenticated) {
      setIsAuthPromptOpen(true);
      return;
    }

    setWishlistedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
          <ProductGrid
            products={products}
            showBadges={showBadges}
            wishlistedIds={wishlistedIds}
            onToggleWishlist={showWishlist ? toggleWishlist : undefined}
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

      {showWishlist && (
        <AuthPromptSheet
          open={isAuthPromptOpen}
          onOpenChange={setIsAuthPromptOpen}
        />
      )}
    </section>
  );
}
