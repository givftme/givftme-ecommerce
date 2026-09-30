import type { WishlistItem } from "@/lib/wishlist/types";
import { getLinkedGiftEstimate } from "./estimate";
import { pricingEnabled } from "./server";
import type { GiftEstimate } from "./types";

// Call only with an item from an authorized shared wishlist read.
// Null preserves the existing display for items outside the pricing rollout.
export async function getSharedGiftEstimate(
  item: WishlistItem,
  pricesVisible: boolean,
): Promise<GiftEstimate | null> {
  if (!pricesVisible || !pricingEnabled() || item.origin !== "external" || !item.product_url) {
    return null;
  }
  return getLinkedGiftEstimate(item.id);
}
