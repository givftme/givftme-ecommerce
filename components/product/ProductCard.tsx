"use client";

import Image from "next/image";
import { Gift, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  price: number;
  compareAtPrice?: number;
  isNew?: boolean;
  isOnFlashSale?: boolean;
}

export interface ProductCardProps {
  product: ProductCardData;
  onToggleWishlist?: (id: string) => void;
  isWishlisted?: boolean;
  showBadges?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  onToggleWishlist,
  isWishlisted,
  showBadges = true,
  className,
}: ProductCardProps) {
  const discountPercent =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(
          ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
        )
      : null;

  return (
    <div className={cn("group", className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gift className="h-10 w-10 text-stone-300" strokeWidth={1.5} />
          </div>
        )}

        {showBadges && discountPercent !== null && (
          <Badge variant="sale" className="absolute left-3 top-3">
            -{discountPercent}%
          </Badge>
        )}
        {showBadges && product.isNew && (
          <Badge variant="muted" className="absolute right-3 top-3 bg-ink text-white">
            New
          </Badge>
        )}

        {onToggleWishlist && !product.isNew && (
          <button
            type="button"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            onClick={() => onToggleWishlist(product.id)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-sm transition-colors hover:text-brand"
          >
            <Heart
              className="h-4 w-4"
              fill={isWishlisted ? "currentColor" : "none"}
            />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button variant="filled" size="sm" className="bg-ink hover:bg-black">
            Add to cart
          </Button>
          <div className="flex items-center gap-3 text-xs font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
            <span className="inline-flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" /> Share
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> Like
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-ink">{product.title}</h3>
        {product.subtitle && (
          <p className="text-sm text-muted">{product.subtitle}</p>
        )}
        <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} />
      </div>
    </div>
  );
}
