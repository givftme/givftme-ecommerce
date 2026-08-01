"use client";

import Image from "next/image";
import Link from "next/link";
import { Gift, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { FlashSaleTimer } from "@/components/flash-sale/FlashSaleTimer";
import type { ProductCardData } from "@/lib/sanity/types";

export type { ProductCardData };

export interface ProductCardProps {
  product: ProductCardData;
  onToggleWishlist?: (id: string) => void;
  onAddToWishlist?: (product: ProductCardData) => void;
  onAddToCart?: (product: ProductCardData) => void;
  onClick?: (product: ProductCardData) => void;
  isWishlisted?: boolean;
  showBadges?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  onToggleWishlist,
  onAddToWishlist,
  onAddToCart,
  onClick,
  isWishlisted,
  showBadges = true,
  className,
}: ProductCardProps) {
  const discountPercent =
    typeof product.price === "number" &&
    product.compareAtPrice &&
    product.compareAtPrice > product.price
      ? Math.round(
          ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
        )
      : null;
  const productHref = `/product/${product.slug}`;
  const wishlistHandler = onAddToWishlist
    ? () => onAddToWishlist(product)
    : onToggleWishlist
      ? () => onToggleWishlist(product.id)
      : undefined;

  return (
    <div className={cn("group", className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
        <Link
          href={productHref}
          className="absolute inset-0"
          onClick={() => onClick?.(product)}
        >
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
          <span className="sr-only">View {product.title}</span>
        </Link>

        {showBadges && product.isOnFlashSale && (
          <Badge variant="sale" className="absolute left-3 top-3">
            Flash sale
            {product.saleEndTime ? (
              <>
                {" · "}
                <FlashSaleTimer endTime={product.saleEndTime} />
              </>
            ) : null}
          </Badge>
        )}
        {showBadges && discountPercent !== null && (
          <Badge
            variant="sale"
            className={cn(
              "absolute left-3",
              product.isOnFlashSale ? "top-12" : "top-3"
            )}
          >
            -{discountPercent}%
          </Badge>
        )}
        {showBadges && product.isNew && (
          <Badge variant="muted" className="absolute right-3 top-3 bg-ink text-white">
            New
          </Badge>
        )}

        {wishlistHandler && !product.isNew && (
          <button
            type="button"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            onClick={wishlistHandler}
            className="pointer-events-auto absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-sm transition-colors hover:text-brand"
          >
            <Heart
              className="h-4 w-4"
              fill={isWishlisted ? "currentColor" : "none"}
            />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/50 px-3 pb-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {onAddToCart ? (
            <Button
              type="button"
              variant="filled"
              size="sm"
              onClick={() => onAddToCart(product)}
              className="bg-ink hover:bg-black"
            >
              {product.hasVariants ? "Choose options" : "Add to cart"}
            </Button>
          ) : (
            <Link
              href={productHref}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              View gift
            </Link>
          )}
          <div className="flex items-center gap-3 text-xs font-medium text-white">
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
        <Link href={productHref} className="block">
          <h3 className="line-clamp-2 font-medium text-ink transition-colors hover:text-brand">
            {product.title}
          </h3>
        </Link>
        {product.subtitle && (
          <p className="text-sm text-muted">{product.subtitle}</p>
        )}
        {typeof product.price === "number" ? (
          <PriceDisplay
            price={product.price}
            compareAtPrice={product.compareAtPrice ?? undefined}
          />
        ) : (
          <p className="text-sm font-semibold text-muted">Price not listed</p>
        )}
      </div>
    </div>
  );
}
