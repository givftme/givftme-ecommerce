"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink, Gift } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { WishlistPickerSheet } from "@/components/shared/WishlistPickerSheet";
import type { ProductCardData } from "@/lib/sanity/types";

interface ExternalGiftDetailProps {
  product: ProductCardData;
}

export function ExternalGiftDetail({ product }: ExternalGiftDetailProps) {
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-surface">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gift className="h-16 w-16 text-stone-300" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="self-start rounded-[2rem] border border-stone-100 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            Fetched gift
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink lg:text-4xl">
            {product.title}
          </h1>
          {product.subtitle ? (
            <p className="mt-3 text-sm leading-6 text-muted">{product.subtitle}</p>
          ) : null}
          {typeof product.price === "number" ? (
            <div className="mt-5">
              <PriceDisplay price={product.price} size="lg" />
              <p className="mt-2 text-xs leading-5 text-muted">
                Estimated Museum price. Final purchase is handled outside Gifvtme.
              </p>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              fullWidth
              onClick={() => setIsWishlistOpen(true)}
            >
              Add to wishlist
            </Button>
            {product.externalUrl ? (
              <a
                href={product.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-200 px-4 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
              >
                View source <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <WishlistPickerSheet
        product={product}
        open={isWishlistOpen}
        onOpenChange={setIsWishlistOpen}
      />
    </>
  );
}
