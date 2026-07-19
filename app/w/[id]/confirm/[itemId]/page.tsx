import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PurchaseConfirmationClient } from "@/components/wishlist/PurchaseConfirmationClient";
import { getDisplayName } from "@/lib/wishlist/display";
import {
  getSharedWishlist,
  getSharedWishlistItem,
} from "@/lib/wishlist/shared";

export const dynamic = "force-dynamic";

export default async function PurchaseConfirmationPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const { user, wishlist } = await getSharedWishlist(id);

  if (!wishlist) {
    notFound();
  }

  const item = getSharedWishlistItem(wishlist, itemId);

  if (!item || item.origin !== "external") {
    notFound();
  }

  const receiverName = getDisplayName(wishlist.owner.full_name);

  return (
    <main className="min-h-dvh bg-surface pb-10">
      <div className="mx-auto min-h-dvh max-w-md bg-white px-4 py-5 md:mt-6 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-6 md:shadow-sm">
        <header className="mb-6 grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Link
            href={`/w/${id}/item/${item.id}`}
            aria-label="Back to item"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="text-center text-sm font-semibold text-muted">Confirm</p>
          <span />
        </header>

        <PurchaseConfirmationClient
          item={item}
          shareId={id}
          receiverName={receiverName}
          pricesVisible={wishlist.prices_visible}
          isAuthenticated={Boolean(user)}
        />
      </div>
    </main>
  );
}
