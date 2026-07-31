/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift, ShoppingCart } from "lucide-react";
import { ClaimedBadge } from "@/components/wishlist/ClaimedBadge";
import { GiverItemActions } from "@/components/wishlist/GiverItemActions";
import { ReceiverAvatar } from "@/components/wishlist/SharedWishlistHeader";
import { trackEvent } from "@/lib/analytics";
import { sanityFetch } from "@/lib/sanity/fetch";
import { PRODUCT_BY_ID_QUERY } from "@/lib/sanity/queries";
import type { ProductFullData } from "@/lib/sanity/types";
import {
  getDisplayName,
  getOccasionLabel,
  getSourceDomain,
} from "@/lib/wishlist/display";
import {
  buildExternalGiftUrl,
  getSharedWishlist,
  getSharedWishlistItem,
} from "@/lib/wishlist/shared";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SharedWishlistItemPage({
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

  if (!item) {
    notFound();
  }

  const receiverName = getDisplayName(wishlist.owner.full_name);
  const occasionTitle = getOccasionLabel(wishlist.occasion?.title);
  const domain = getSourceDomain(item.product_url);
  const externalUrl = buildExternalGiftUrl(item);
  const claimed = item.status === "purchased";

  let catalogProduct: ProductFullData | null = null;

  if (
    item.origin === "catalog" &&
    item.catalog_product_id &&
    !item.catalog_unavailable
  ) {
    try {
      catalogProduct = await sanityFetch<ProductFullData | null>(
        PRODUCT_BY_ID_QUERY,
        { id: item.catalog_product_id }
      );
    } catch (error) {
      console.error("Failed to fetch catalog product for wishlist item", error);
    }
  }

  trackEvent("shared_wishlist.item.viewed", {
    item_id: item.id,
    origin: item.origin,
  });

  return (
    <main className="min-h-dvh bg-surface pb-10">
      <div className="mx-auto min-h-dvh max-w-3xl bg-white px-4 py-5 md:mt-6 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-6 md:shadow-sm">
        <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Link
            href={`/w/${id}`}
            aria-label="Back to wishlist"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="text-center text-sm font-semibold text-muted">
            Wishlist
          </p>
          {item.origin === "catalog" ? (
            <Link
              href="/cart"
              aria-label="Cart"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
            >
              <ShoppingCart className="h-5 w-5" />
            </Link>
          ) : (
            <span />
          )}
        </header>

        <section className="mt-5">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-surface">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Gift className="h-14 w-14 text-stone-300" strokeWidth={1.5} />
            )}
            <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm">
              {item.origin === "catalog"
                ? "Gifvtme store"
                : `From ${domain || "store"}`}
            </span>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {wishlist.prices_visible && item.price != null && item.price > 0 && (
            <p className="text-2xl font-bold text-brand">
              {formatPrice(item.price)}
            </p>
          )}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold leading-7 text-ink">
              {item.title}
            </h1>
            {claimed && <ClaimedBadge />}
          </div>

          {item.origin === "catalog" && (
            <p className="text-sm font-medium text-amber-700">Limited</p>
          )}

          {item.description && (
            <p className="text-sm leading-6 text-muted">{item.description}</p>
          )}

          <div className="flex items-center gap-2 rounded-2xl bg-surface p-3">
            <ReceiverAvatar owner={wishlist.owner} size="sm" />
            <p className="text-sm text-muted">
              On {receiverName}&apos;s {occasionTitle} wishlist
            </p>
          </div>

          {claimed ? (
            <div className="rounded-2xl bg-surface p-4 text-sm leading-6 text-muted">
              This gift has already been claimed, so the buy action is no longer
              available.
            </div>
          ) : (
            <GiverItemActions
              item={item}
              shareId={id}
              receiverName={receiverName}
              isAuthenticated={Boolean(user)}
              currentUserId={user?.id ?? null}
              isOwner={wishlist.viewer_is_owner}
              externalUrl={externalUrl}
              catalogProduct={catalogProduct}
            />
          )}
        </section>
      </div>
    </main>
  );
}
