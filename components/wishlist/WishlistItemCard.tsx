"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Gift,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Badge } from "@/components/ui/Badge";
import { getSourceDomain, formatWishlistPrice } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

function WishlistItemImage({ item }: { item: WishlistItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.image_url || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface">
        <Gift className="h-7 w-7 text-stone-300" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt=""
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-xl object-cover"
    />
  );
}

export function WishlistItemCard({
  item,
  reorderMode,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isRemoving,
  readOnly = false,
}: {
  item: WishlistItem;
  reorderMode: boolean;
  index: number;
  total: number;
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  isRemoving?: boolean;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isPurchased = item.status === "purchased";
  const domain = getSourceDomain(item.product_url);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <article
      ref={ref}
      data-item-id={item.id}
      className={cn(
        "rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-opacity",
        isPurchased && "opacity-50",
        isRemoving && "opacity-40"
      )}
    >
      <div className="flex items-center gap-3">
        {reorderMode && !readOnly && (
          <div className="flex shrink-0 items-center gap-1 text-muted">
            <GripVertical className="h-4 w-4" />
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Move item up"
                disabled={index === 0}
                onClick={() => onMoveUp(item.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-brand-light hover:text-brand disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move item down"
                disabled={index === total - 1}
                onClick={() => onMoveDown(item.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-brand-light hover:text-brand disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <WishlistItemImage item={item} />

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-5 text-ink">
            {item.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-ink">
            {formatWishlistPrice(item.price)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {item.origin === "catalog" ? (
              <Badge variant="default">Gifvtme store</Badge>
            ) : (
              domain && <span>{domain}</span>
            )}
            {isPurchased && (
              <>
                <Badge variant="success">Gifted</Badge>
                <span>by {item.buyer_name || "a giver"}</span>
              </>
            )}
          </div>
        </div>

        {!readOnly && !isPurchased && !reorderMode && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Edit item"
              onClick={() => onEdit(item)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-light hover:text-brand"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Delete item"
              onClick={() => onDelete(item)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
