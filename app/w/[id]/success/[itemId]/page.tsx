import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GiftClaimedSuccess } from "@/components/wishlist/GiftClaimedSuccess";
import { getDisplayName } from "@/lib/wishlist/display";
import {
  getSharedWishlist,
  getSharedWishlistItem,
} from "@/lib/wishlist/shared";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Gift Claimed", robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default async function ClaimedSuccessPage({
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

  if (!item || item.status !== "purchased") {
    notFound();
  }

  return (
    <GiftClaimedSuccess
      wishlist={wishlist}
      item={item}
      receiverName={getDisplayName(wishlist.owner.full_name)}
      isAuthenticated={Boolean(user)}
    />
  );
}
