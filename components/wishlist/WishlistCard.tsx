"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, Link2, PencilLine, Share2, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { WishlistSummary } from "@/lib/wishlist/types";
import { ShareSettingsSheet } from "@/components/wishlist/ShareSettingsSheet";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

export function WishlistCard({ wishlist }: { wishlist: WishlistSummary }) {
  const [shareOpen, setShareOpen] = useState(false);
  const isEmpty = wishlist.item_count === 0;

  return (
    <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Badge variant="default">Evergreen</Badge>
          <div>
            <WishlistTitleEditor
              wishlistId={wishlist.id}
              initialTitle={wishlist.title}
              textClassName="text-2xl font-bold text-ink"
            />
            <p className="mt-1 text-sm text-muted">
              {wishlist.item_count} {wishlist.item_count === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <Gift className="h-6 w-6" strokeWidth={1.75} />
        </div>
      </div>

      {isEmpty ? (
        /* An empty wishlist gets an intentional empty state, never the
           populated "View wishlist" treatment. Source order is catalogue
           first, then the external link and manual paths. */
        <>
          <div className="mt-5 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
            Nothing on your list yet. Start with the Gifvtme store.
          </div>

          <Link
            href={`/shop?wishlist=${wishlist.id}`}
            className={cn(buttonVariants({ variant: "filled" }), "mt-5 h-11 w-full")}
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
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={`/wishlists/${wishlist.id}`}
            className={cn(buttonVariants({ variant: "filled" }), "h-11")}
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
