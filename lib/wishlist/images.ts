export const WISHLIST_IMAGES_BUCKET = "wishlist-images";

export const WISHLIST_STORAGE_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/i;

export function isWishlistStoragePath(value: string, userId?: string) {
  return (
    WISHLIST_STORAGE_PATH_PATTERN.test(value) &&
    (!userId || value.startsWith(`${userId}/`))
  );
}

export function getWishlistStoragePathFromImageRef(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (isWishlistStoragePath(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex(
      (part, index) =>
        part === "storage" &&
        parts[index + 1] === "v1" &&
        parts[index + 2] === "object"
    );

    if (objectIndex < 0) {
      return null;
    }

    const bucketIndex =
      parts[objectIndex + 3] === "public" || parts[objectIndex + 3] === "sign"
        ? objectIndex + 4
        : objectIndex + 3;

    if (parts[bucketIndex] !== WISHLIST_IMAGES_BUCKET) {
      return null;
    }

    const path = parts.slice(bucketIndex + 1).map(decodeURIComponent).join("/");

    return isWishlistStoragePath(path) ? path : null;
  } catch {
    return null;
  }
}

export function normalizeWishlistImageRef(
  value: string | null | undefined,
  userId: string
) {
  if (!value) {
    return null;
  }

  const storagePath = getWishlistStoragePathFromImageRef(value);

  if (!storagePath) {
    return value;
  }

  return isWishlistStoragePath(storagePath, userId) ? storagePath : null;
}
