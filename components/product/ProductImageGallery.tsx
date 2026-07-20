"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Gift } from "lucide-react";
import gsap from "gsap";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type { SanityImageAsset } from "@/lib/sanity/types";

interface ProductImageGalleryProps {
  productId: string;
  title: string;
  images: SanityImageAsset[];
  isOnFlashSale?: boolean;
  discountPercent?: number | null;
  isNew?: boolean;
}

export function ProductImageGallery({
  productId,
  title,
  images,
  isOnFlashSale,
  discountPercent,
  isNew,
}: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const activeImage = images[activeIndex];

  const swapImage = (index: number) => {
    if (index === activeIndex) {
      return;
    }

    if (!imageRef.current) {
      setActiveIndex(index);
      return;
    }

    gsap.to(imageRef.current, {
      autoAlpha: 0,
      duration: 0.15,
      ease: "power1.out",
      onComplete: () => {
        setActiveIndex(index);
        requestAnimationFrame(() => {
          if (imageRef.current) {
            gsap.to(imageRef.current, {
              autoAlpha: 1,
              duration: 0.2,
              ease: "power1.out",
            });
          }
        });
      },
    });
    trackEvent("museum.product.image_swapped", {
      product_id: productId,
      image_index: index,
    });
  };

  return (
    <div className="space-y-4">
      <div
        ref={imageRef}
        className="relative aspect-square overflow-hidden rounded-2xl bg-surface"
      >
        {activeImage?.url ? (
          <Image
            src={activeImage.url}
            alt={activeImage.alt || title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            preload={activeIndex === 0}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gift className="h-12 w-12 text-stone-300" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {isOnFlashSale ? <Badge variant="sale">Flash sale</Badge> : null}
          {discountPercent ? (
            <Badge variant="sale" className="h-12 w-12 rounded-full p-0">
              -{discountPercent}%
            </Badge>
          ) : null}
        </div>
        {isNew ? (
          <Badge variant="muted" className="absolute right-4 top-4 bg-ink text-white">
            New
          </Badge>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-3">
          {images.slice(0, 5).map((image, index) => (
            <button
              key={image._key || image.url || index}
              type="button"
              aria-label={`Show image ${index + 1}`}
              onClick={() => swapImage(index)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-surface transition-colors",
                index === activeIndex ? "border-brand" : "border-stone-100"
              )}
            >
              {image.url ? (
                <Image
                  src={image.url}
                  alt={image.alt || title}
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
              ) : (
                <Gift className="mx-auto h-full w-6 text-stone-300" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
