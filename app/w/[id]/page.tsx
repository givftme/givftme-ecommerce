import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedWishlistClient } from "@/components/wishlist/SharedWishlistClient";
import { SharedWishlistNotice } from "@/components/wishlist/SharedWishlistNotice";
import { DEFAULT_OG_IMAGE, NO_INDEX, SITE_NAME, TWITTER_HANDLE } from "@/lib/seo/metadata";
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

  // Private lists and unknown links never reveal the receiver's name.
  if (status !== "ok" || !wishlist || wishlist.visibility === "private") {
    return {
      title: "Wishlist",
      description: "View this wishlist on Givftme.",
      robots: NO_INDEX,
      openGraph: {
        title: "Wishlist — Givftme",
        description: "View this wishlist on Givftme.",
        siteName: SITE_NAME,
        type: "website",
        images: [DEFAULT_OG_IMAGE],
      },
      twitter: {
        card: "summary_large_image",
      site: TWITTER_HANDLE,
        images: [DEFAULT_OG_IMAGE.url],
      },
    };
  }

  const receiverName = getDisplayName(wishlist.owner.full_name);
  const occasionTitle = wishlist.occasion?.title.trim() || null;
  const title = occasionTitle
    ? `${receiverName}'s ${occasionTitle} Wishlist`
    : `${receiverName}'s Wishlist`;
  const total = wishlist.items.length;
  const available = wishlist.items.filter((item) => item.status === "available").length;
  const description = occasionTitle
    ? `Help ${receiverName} celebrate their ${occasionTitle} — ${total} wishes, ${available} still available.`
    : `${receiverName} has ${total} gift wishes, ${available} still available. View their wishlist on Givftme.`;
  const fullTitle = `${title} — ${SITE_NAME}`;
  const ogImageUrl = `/api/og/wishlist/${id}`;

  return {
    title,
    description,
    alternates: { canonical: `/w/${id}` },
    robots: wishlist.visibility === "public" ? undefined : NO_INDEX,
    openGraph: {
      title: fullTitle,
      description,
      url: `/w/${id}`,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
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

  const wishlistWithPoolState = wishlist;

  const estimates: Record<string, GiftEstimate | null> = {};
  // Each estimate makes sequential reads; cap the page's database concurrency.
  for (let offset = 0; offset < wishlistWithPoolState.items.length; offset += ESTIMATE_BATCH_SIZE) {
    const entries = await Promise.all(
      wishlistWithPoolState.items.slice(offset, offset + ESTIMATE_BATCH_SIZE).map(async (item) => [
        item.id,
        await getSharedGiftEstimate(item, wishlist.prices_visible),
      ] as const),
    );
    Object.assign(estimates, Object.fromEntries(entries));
  }

  return (
    <SharedWishlistClient
      wishlist={wishlistWithPoolState}
      estimates={estimates}
      isAuthenticated={Boolean(user)}
    />
  );
}
