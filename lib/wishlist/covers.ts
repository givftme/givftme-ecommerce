/**
 * Wishlist cover palette. Keys are stored in `wishlists.cover_color`, and the
 * database constraint in gifvtme_migration_029_wishlist_cover_color.sql must
 * list the same keys. Every gradient keeps white text readable.
 */
export const WISHLIST_COVER_KEYS = [
  "ruby",
  "midnight",
  "sunset",
  "forest",
  "ocean",
  "plum",
  "blush",
] as const;

export type WishlistCoverKey = (typeof WISHLIST_COVER_KEYS)[number];

export const DEFAULT_WISHLIST_COVER: WishlistCoverKey = "ruby";

export const WISHLIST_COVERS: Record<
  WishlistCoverKey,
  { label: string; className: string }
> = {
  ruby: { label: "Givtme red", className: "bg-linear-to-br from-brand via-red to-orange" },
  midnight: { label: "Midnight", className: "bg-linear-to-br from-stone-900 via-stone-800 to-stone-950" },
  sunset: { label: "Sunset", className: "bg-linear-to-br from-orange via-orange-500 to-amber-500" },
  forest: { label: "Forest", className: "bg-linear-to-br from-emerald-700 via-emerald-600 to-teal-500" },
  ocean: { label: "Ocean", className: "bg-linear-to-br from-blue via-blue-600 to-sky-500" },
  plum: { label: "Plum", className: "bg-linear-to-br from-purple-800 via-purple-700 to-fuchsia-600" },
  blush: { label: "Blush", className: "bg-linear-to-br from-rose-600 via-rose-500 to-pink-400" },
};

export function isWishlistCoverKey(value: unknown): value is WishlistCoverKey {
  return (
    typeof value === "string" &&
    (WISHLIST_COVER_KEYS as readonly string[]).includes(value)
  );
}

export function getWishlistCoverClass(cover: string | null | undefined) {
  return WISHLIST_COVERS[isWishlistCoverKey(cover) ? cover : DEFAULT_WISHLIST_COVER]
    .className;
}
