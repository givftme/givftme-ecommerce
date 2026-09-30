import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedWishlistClient } from "@/components/wishlist/SharedWishlistClient";
import { SharedWishlistNotice } from "@/components/wishlist/SharedWishlistNotice";
import { getDisplayName, getOccasionLabel } from "@/lib/wishlist/display";
import { getSharedWishlist } from "@/lib/wishlist/shared";
import { getSharedGiftEstimate } from "@/lib/pricing/shared";
import type { GiftEstimate } from "@/lib/pricing/types";

export const dynamic = "force-dynamic";

const ESTIMATE_BATCH_SIZE = 4;

type SharedWishlistPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: SharedWishlistPageProps): Promise<Metadata> {
  const { id } = await params;
  const { wishlist, status } = await getSharedWishlist(id);

  if (status !== "ok" || !wishlist) {
    return { title: "Shared wishlist · Givftme" };
  }

  const receiverName = getDisplayName(wishlist.owner.full_name);
  const occasionLabel = wishlist.occasion
    ? getOccasionLabel(wishlist.occasion.title)
    : null;
  const title = occasionLabel
    ? `${receiverName}'s Wishlist for ${occasionLabel}`
    : `${receiverName}'s Wishlist`;
  const description = occasionLabel
    ? `Help ${receiverName} celebrate their ${occasionLabel} — view their wishlist on Givftme.`
    : `See what ${receiverName} is wishing for on Givftme.`;

  return {
    title,
    description,
    robots:
      wishlist.visibility === "public"
        ? undefined
        : { index: false, follow: false },
  };
}

export default async function SharedWishlistPage({
  params,
}: SharedWishlistPageProps) {
  const { id } = await params;
  const { user, wishlist, status } = await getSharedWishlist(id);

  if (status === "not_found") {
    notFound();
  }

  if (status === "restricted") {
    return (
      <SharedWishlistNotice
        title="This wishlist is private."
        description="Ask the owner to share an invite link with you to view it."
      />
    );
  }

  if (status === "error" || !wishlist) {
    return (
      <SharedWishlistNotice
        title="Something went wrong loading this wishlist."
        description="Please try refreshing."
      />
    );
  }

  if (wishlist.occasion?.status === "archived") {
    return (
      <SharedWishlistNotice
        title="This occasion has passed."
        description={`${getDisplayName(wishlist.owner.full_name)}'s ${getOccasionLabel(wishlist.occasion.title)} wishlist is no longer open, but there's plenty more to discover.`}
        cta={{ label: "Explore the gift museum", href: "/shop" }}
      />
    );
  }

  const estimates: Record<string, GiftEstimate | null> = {};
  // Each estimate makes sequential reads; cap the page's database concurrency.
  for (let offset = 0; offset < wishlist.items.length; offset += ESTIMATE_BATCH_SIZE) {
    const entries = await Promise.all(
      wishlist.items.slice(offset, offset + ESTIMATE_BATCH_SIZE).map(async (item) => [
        item.id,
        await getSharedGiftEstimate(item, wishlist.prices_visible),
      ] as const),
    );
    Object.assign(estimates, Object.fromEntries(entries));
  }

  return (
    <SharedWishlistClient
      wishlist={wishlist}
      estimates={estimates}
      isAuthenticated={Boolean(user)}
    />
  );
}
