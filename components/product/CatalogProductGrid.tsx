"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { WishlistPickerSheet } from "@/components/shared/WishlistPickerSheet";
import { useCart } from "@/components/cart/CartContext";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { ProductCardData } from "@/lib/sanity/types";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface CatalogProductGridProps {
  products: ProductCardData[];
  emptyMessage?: string;
  showBadges?: boolean;
  className?: string;
}

export function CatalogProductGrid({
  products,
  emptyMessage,
  showBadges = true,
  className,
}: CatalogProductGridProps) {
  const [wishlistProduct, setWishlistProduct] = useState<ProductCardData | null>(
    null
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const { addItem } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    fetch("/api/wishlists/catalog-items", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { catalogProductIds?: string[] } | null) => {
        if (isActive && payload?.catalogProductIds) {
          setWishlistedIds(new Set(payload.catalogProductIds));
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, []);

  useGSAP(
    () => {
      if (!gridRef.current) {
        return;
      }

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(gridRef.current!.querySelectorAll(".catalog-product-card"), {
          autoAlpha: 0,
          y: 24,
          stagger: 0.05,
          duration: 0.35,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
            once: true,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: gridRef, dependencies: [products.length] }
  );

  const handleAddToCart = (product: ProductCardData) => {
    if (product.hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }

    if (typeof product.price !== "number") {
      toast({
        title: "Price not listed",
        description: "Open the product page for the latest details.",
      });
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
    trackEvent("museum.product.add_to_cart", {
      product_id: product.catalogProductId,
      variant_key: null,
      quantity: 1,
      price: product.price,
    });
    toast({ title: "Added to cart ✓", variant: "success" });
  };

  const handleAddToWishlist = (product: ProductCardData) => {
    setWishlistProduct(product);
    setIsWishlistOpen(true);
  };

  return (
    <>
      <div ref={gridRef}>
        <ProductGrid
          products={products}
          showBadges={showBadges}
          emptyMessage={emptyMessage}
          onAddToCart={handleAddToCart}
          onAddToWishlist={handleAddToWishlist}
          wishlistedIds={wishlistedIds}
          className={className}
        />
      </div>
      <WishlistPickerSheet
        product={wishlistProduct}
        open={isWishlistOpen}
        onOpenChange={setIsWishlistOpen}
        onAdded={(catalogProductId) =>
          setWishlistedIds((current) => new Set(current).add(catalogProductId))
        }
      />
    </>
  );
}
