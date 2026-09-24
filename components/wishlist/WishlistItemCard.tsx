"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import {
  ArrowUp,
  Gift,
  Link2,
  PencilLine,
  Pencil,
  Store,
  Trash2,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Badge } from "@/components/ui/Badge";
import { getSourceDomain, formatWishlistPrice } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const iconButtonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-30";

function WishlistItemImage({ item }: { item: WishlistItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.image_url || failed) {
    const Fallback =
      item.origin === "catalog" ? Gift : item.product_url ? Link2 : PencilLine;

    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand sm:h-19.5 sm:w-19.5">
        <Fallback className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt=""
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-2xl bg-surface object-cover sm:h-19.5 sm:w-19.5"
    />
  );
}

function ItemSource({ item }: { item: WishlistItem }) {
  const domain = getSourceDomain(item.product_url);

  if (item.origin === "catalog") {
    return (
      <span className="inline-flex items-center gap-1">
        <Store className="h-3.5 w-3.5" aria-hidden="true" />
        Gifvtme store
      </span>
    );
  }

  if (domain) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{domain}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
      Added by you
    </span>
  );
}

export function WishlistItemCard({
  item,
  index,
  onEdit,
  onDelete,
  onMoveUp,
  isMoving = false,
  isRemoving,
  readOnly = false,
}: {
  item: WishlistItem;
  index: number;
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
  /** Shows a move-up control when provided. */
  onMoveUp?: (itemId: string) => void;
  isMoving?: boolean;
  isRemoving?: boolean;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isPurchased = item.status === "purchased";
  const hasPrice = item.price != null && item.price > 0;
  const showActions = !readOnly && !isPurchased;

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
        "flex flex-wrap items-center gap-3 rounded-[20px] bg-white p-3 transition-[opacity,box-shadow] hover:shadow-soft sm:flex-nowrap sm:gap-3.5 sm:rounded-[22px]",
        isPurchased && "opacity-60",
        isRemoving && "opacity-40"
      )}
    >
      <WishlistItemImage item={item} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="line-clamp-2 wrap-break-word text-sm font-semibold leading-snug text-ink sm:text-[15px]">
          {item.title}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <ItemSource item={item} />
          <span
            className={cn(
              "break-all",
              hasPrice ? "font-semibold text-brand" : "text-muted"
            )}
          >
            {formatWishlistPrice(item.price)}
          </span>
        </div>
        {isPurchased && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge variant="success" className="gap-1">
              <Gift className="h-3 w-3" aria-hidden="true" />
              Gifted
            </Badge>
            <span>by {item.buyer_name || "a giver"}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
          {onMoveUp && (
            <button
              type="button"
              aria-label={`Move ${item.title} up`}
              disabled={index === 0 || isMoving}
              onClick={() => onMoveUp(item.id)}
              className={iconButtonClass}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Edit ${item.title}`}
            onClick={() => onEdit(item)}
            className={iconButtonClass}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${item.title}`}
            onClick={() => onDelete(item)}
            className={cn(iconButtonClass, "hover:border-brand hover:text-brand")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  );
}
