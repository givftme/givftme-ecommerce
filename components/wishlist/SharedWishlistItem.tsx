"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/Button";
import { ClaimedBadge } from "@/components/wishlist/ClaimedBadge";
import { IntentFlagBadge } from "@/components/wishlist/IntentFlagBadge";
import { getSourceDomain } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import { cn, formatPrice } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

function SharedItemImage({ item }: { item: WishlistItem }) {
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

export function SharedWishlistItem({
  item,
  shareId,
  pricesVisible,
  index,
  onAuthRequired,
}: {
  item: WishlistItem;
  shareId: string;
  pricesVisible: boolean;
  index: number;
  onAuthRequired: (redirectPath: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const claimed = item.status === "purchased";
  const domain = getSourceDomain(item.product_url);
  const detailPath = `/w/${shareId}/item/${item.id}`;

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        autoAlpha: 0,
        y: 20,
        delay: index * 0.06,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <article
      ref={ref}
      className={cn(
        "rounded-2xl border border-stone-100 bg-white p-4 shadow-sm",
        claimed && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <SharedItemImage item={item} />

        <div className="min-w-0 flex-1">
          <Link
            href={detailPath}
            className={cn(
              "line-clamp-2 text-sm font-medium leading-5 text-ink hover:text-brand",
              claimed && "line-through"
            )}
          >
            {item.title}
          </Link>

          {pricesVisible && item.price != null && item.price > 0 && (
            <p className="mt-1 text-sm font-semibold text-ink">
              {formatPrice(item.price)}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
              {item.origin === "catalog"
                ? "Gifvtme store"
                : `From ${domain || "store"}`}
            </span>
            {!claimed && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                Available
              </span>
            )}
          </div>

          {!claimed && item.intent_flagged_by && (
            <div className="mt-2">
              <IntentFlagBadge />
            </div>
          )}
        </div>

        {claimed ? (
          <ClaimedBadge className="shrink-0" />
        ) : (
          <Button
            type="button"
            size="sm"
            className="shrink-0 px-3"
            onClick={() => onAuthRequired(detailPath)}
          >
            Buy this gift
          </Button>
        )}
      </div>
    </article>
  );
}
