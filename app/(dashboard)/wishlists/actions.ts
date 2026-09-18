"use server";

import { revalidatePath } from "next/cache";

// `router.refresh()` only clears the Client Cache for the route the caller is
// on (see next/dist/docs .../functions/use-router.md). Owner-facing wishlist
// data is rendered on several routes, and visited pages are reused on browser
// back/forward navigation, so refreshing `/wishlists/<id>` after a mutation
// leaves the `/wishlists` card and the occasion pages showing pre-mutation
// counts. Revalidating from a Server Function invalidates those entries too,
// so a later visit re-renders against committed server state.

const WISHLIST_ID_PATTERN = /^[0-9a-zA-Z-]{1,64}$/;

export async function revalidateWishlistViews(wishlistId?: string) {
  revalidatePath("/wishlists");
  revalidatePath("/my-occasions");
  revalidatePath("/my-occasions/[id]", "page");

  // Only ever build a path from an id we have shape-checked, so a caller
  // cannot steer revalidation at an arbitrary route.
  if (wishlistId && WISHLIST_ID_PATTERN.test(wishlistId)) {
    revalidatePath(`/wishlists/${wishlistId}`);
  }
}
