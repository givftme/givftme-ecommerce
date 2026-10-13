import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/wishlist/display";
import { signWishlistImages } from "@/lib/wishlist/server";

type JsonRecord = Record<string, unknown>;

// Signed and fetched up front; a few spares cover broken or WebP images.
const MAX_IMAGE_CANDIDATES = 6;

export type WishlistOgData = {
  receiverName: string;
  avatarUrl: string | null;
  occasionTitle: string | null;
  occasionDate: string | null;
  availableCount: number;
  /** Signed or absolute image URLs of available items, in list order. */
  imageUrls: string[];
};

export type WishlistOgResult =
  | { kind: "ok"; data: WishlistOgData }
  | { kind: "not_found" | "private" | "db_error" };

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

/**
 * Resolves a share key the way a signed-out visitor would, through the same
 * access-checked RPC as the shared wishlist page. Link-preview crawlers have
 * no session, so private and invite-only-by-UUID lists come back restricted
 * and never reach the image.
 */
export async function getWishlistOgData(shareKey: string): Promise<WishlistOgResult> {
  const { data, error } = await createPublicClient().rpc("gifvtme_get_shared_wishlist", {
    p_share_key: shareKey,
  });

  if (error) {
    console.error("Could not resolve wishlist for OG image.", error);
    return { kind: "db_error" };
  }

  const root = asRecord(data);
  const access = asString(root.access);

  if (access === "restricted") {
    return { kind: "private" };
  }

  const wishlist = asRecord(root.wishlist);
  const owner = asRecord(wishlist.owner);
  const ownerId = asString(owner.id);

  if (access !== "ok" || !ownerId) {
    return { kind: "not_found" };
  }

  if (wishlist.visibility === "private") {
    return { kind: "private" };
  }

  const occasion = wishlist.occasion ? asRecord(wishlist.occasion) : null;
  const availableItems = (Array.isArray(wishlist.items) ? wishlist.items : [])
    .map(asRecord)
    .filter((item) => item.status === "available")
    .map((item) => ({ image_url: asString(item.image_url) }));

  let imageUrls: string[] = [];

  try {
    const signed = await signWishlistImages(
      createServiceClient(),
      ownerId,
      availableItems.filter((item) => item.image_url).slice(0, MAX_IMAGE_CANDIDATES),
    );
    imageUrls = signed.map((item) => item.image_url).filter((url): url is string => Boolean(url));
  } catch (signError) {
    console.error("Could not sign wishlist images for OG image.", signError);
  }

  return {
    kind: "ok",
    data: {
      receiverName: getDisplayName(asString(owner.full_name)),
      avatarUrl: asString(owner.avatar_url),
      occasionTitle: asString(occasion?.title)?.trim() || null,
      occasionDate: asString(occasion?.occasion_date),
      availableCount: availableItems.length,
      imageUrls,
    },
  };
}
