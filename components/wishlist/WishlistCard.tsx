"use client";

import Link from "next/link";
import { Gift, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { WishlistSummary } from "@/lib/wishlist/types";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

export function WishlistCard({ wishlist }: { wishlist: WishlistSummary }) {
  const { toast } = useToast();

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

      {wishlist.item_count === 0 && (
        <div className="mt-5 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
          Add things you&apos;d love to receive.
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={`/dashboard/wishlists/${wishlist.id}`}
          className={cn(buttonVariants({ variant: "filled" }), "h-11")}
        >
          View wishlist
        </Link>
        <button
          type="button"
          onClick={() => toast({ title: "Sharing coming soon." })}
          className={cn(buttonVariants({ variant: "ghost" }), "h-11")}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </section>
  );
}
