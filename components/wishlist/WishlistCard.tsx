"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, Link2, PencilLine, Share2, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getVisibilityLabel } from "@/lib/wishlist/display";
import type { WishlistSummary } from "@/lib/wishlist/types";
import { ShareSettingsSheet } from "@/components/wishlist/ShareSettingsSheet";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

export function WishlistCard({ wishlist }: { wishlist: WishlistSummary }) {
  const [shareOpen, setShareOpen] = useState(false);
  const isEmpty = wishlist.item_count === 0;

  return (
    <section className="overflow-hidden rounded-3xl bg-white">
      <div className="relative isolate flex min-h-44 flex-col justify-end gap-1 overflow-hidden bg-linear-to-br from-brand via-red to-orange p-5 pt-14 text-white sm:min-h-48 sm:p-6 sm:pt-14">
        <Gift
          aria-hidden="true"
          strokeWidth={1.25}
          className="pointer-events-none absolute -right-5 -bottom-7 -z-10 h-40 w-40 text-white/15"
        />
        <div className="absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-2 sm:inset-x-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" />
            Evergreen
          </span>
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
            {getVisibilityLabel(wishlist.visibility)}
          </span>
        </div>
        <WishlistTitleEditor
          wishlistId={wishlist.id}
          initialTitle={wishlist.title}
          className="max-w-full"
          textClassName="font-display text-3xl leading-tight text-white sm:text-4xl"
          inputClassName="h-12 font-display text-xl text-ink"
          iconClassName="text-white/80 group-hover:text-white"
        />
        <p className="text-sm text-white/85">
          {wishlist.item_count} {wishlist.item_count === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {isEmpty ? (
          /* An empty wishlist gets an intentional empty state, never the
             populated "View wishlist" treatment. Source order is catalogue
             first, then the external link and manual paths. */
          <>
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
              Nothing on your list yet. Start with the Gifvtme store.
            </div>

            <Link
              href={`/shop?wishlist=${wishlist.id}`}
              className={cn(buttonVariants({ variant: "filled" }), "mt-4 h-11 w-full shadow-soft")}
            >
              <Store className="h-4 w-4" />
              Browse Gifvtme - add your first gift
            </Link>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link
                href={`/wishlists/${wishlist.id}?add=url`}
                className={cn(buttonVariants({ variant: "ghost" }), "h-11")}
              >
                <Link2 className="h-4 w-4" />
                Paste product link
              </Link>
              <Link
                href={`/wishlists/${wishlist.id}?add=manual`}
                className={cn(buttonVariants({ variant: "ghost" }), "h-11")}
              >
                <PencilLine className="h-4 w-4" />
                Add manually
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className={cn(buttonVariants({ variant: "text" }), "mt-3 h-10 w-full")}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/wishlists/${wishlist.id}`}
              className={cn(buttonVariants({ variant: "filled" }), "h-11 shadow-soft")}
            >
              View wishlist
            </Link>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className={cn(buttonVariants({ variant: "ghost" }), "h-11")}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        )}
      </div>

      <ShareSettingsSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        wishlistId={wishlist.id}
        initialVisibility={wishlist.visibility}
        initialPricesVisible={wishlist.prices_visible}
      />
    </section>
  );
}
