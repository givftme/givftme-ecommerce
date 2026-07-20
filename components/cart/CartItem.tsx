"use client";

import { useRef } from "react";
import Image from "next/image";
import { Star, Trash2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import type { CartItem as CartItemData } from "@/components/cart/CartContext";

gsap.registerPlugin(useGSAP);

interface CartItemProps {
  item: CartItemData;
  onQuantityChange: (item: CartItemData, quantity: number) => void;
  onRemove: (item: CartItemData) => void;
  rating?: {
    avg: number;
    count: number;
  } | null;
  unavailableReason?: string;
}

function formatVariantInfo(options: Record<string, string>) {
  const entries = Object.entries(options);

  if (entries.length === 0) {
    return "";
  }

  return entries
    .map(([attribute, value]) => `${attribute}: ${value}`)
    .join(", ");
}

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  rating,
  unavailableReason,
}: CartItemProps) {
  const itemRef = useRef<HTMLElement>(null);
  const variantInfo = formatVariantInfo(item.selected_options);

  const handleRemove = () => {
    if (!itemRef.current) {
      onRemove(item);
      return;
    }

    gsap.to(itemRef.current, {
      opacity: 0,
      x: 30,
      height: 0,
      marginBottom: 0,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => onRemove(item),
    });
  };

  return (
    <article
      ref={itemRef}
      className="overflow-hidden rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
    >
      <div className="relative flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">
          {item.product_image_url ? (
            <Image
              src={item.product_image_url}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pr-10">
          <h2 className="truncate text-sm font-semibold text-ink">
            {item.product_title}
          </h2>
          {variantInfo ? (
            <p className="mt-1 truncate text-xs text-muted">{variantInfo}</p>
          ) : null}
          {rating && rating.count > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted">
              <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
              {rating.avg.toFixed(1)} ({rating.count})
            </p>
          ) : null}
          <div className="mt-2">
            <PriceDisplay price={item.unit_price} size="sm" />
          </div>
        </div>

        <button
          type="button"
          aria-label={`Remove ${item.product_title}`}
          onClick={handleRemove}
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand-light"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {unavailableReason ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {unavailableReason}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-4">
        <QuantityStepper
          value={item.quantity}
          onChange={(quantity) => onQuantityChange(item, quantity)}
          min={1}
          max={99}
        />
        <p className="text-sm font-semibold text-ink">
          <PriceDisplay price={item.unit_price * item.quantity} size="sm" />
        </p>
      </div>
    </article>
  );
}
