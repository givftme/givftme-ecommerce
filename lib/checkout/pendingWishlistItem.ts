const STORAGE_KEY = "gifvtme.pending-wishlist-item";

interface PendingWishlistItem {
  wishlistItemId: string;
  catalogProductId: string;
}

export function setPendingWishlistItem(item: PendingWishlistItem) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
  } catch {
    // Best-effort — checkout still works without the wishlist association.
  }
}

export function getPendingWishlistItem(): PendingWishlistItem | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PendingWishlistItem>;

    if (
      typeof parsed.wishlistItemId !== "string" ||
      typeof parsed.catalogProductId !== "string"
    ) {
      return null;
    }

    return { wishlistItemId: parsed.wishlistItemId, catalogProductId: parsed.catalogProductId };
  } catch {
    return null;
  }
}

export function clearPendingWishlistItem() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
