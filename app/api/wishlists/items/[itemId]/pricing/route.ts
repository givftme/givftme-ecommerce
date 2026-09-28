import { createServiceClient } from "@/lib/supabase/server";
import { getSharedWishlist, getSharedWishlistItem, isUuidLike } from "@/lib/wishlist/shared";
import { getLinkedGiftEstimate } from "@/lib/pricing/estimate";
import { pricingFailure, pricingJson } from "@/lib/pricing/http";
import { pricingEnabled } from "@/lib/pricing/server";

export async function GET(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await context.params;
    if (!isUuidLike(itemId) || !pricingEnabled()) return pricingJson({ error: "Not found." }, 404);
    const db = createServiceClient();
    // Privileged lookup resolves only the access context, never a public response.
    const { data, error } = await db.from("wishlist_items").select("wishlist_id").eq("id", itemId).maybeSingle();
    if (error) return pricingJson({ error: "pricing_unavailable" }, 503);
    if (!data) return pricingJson({ error: "Not found." }, 404);
    const { wishlist } = await getSharedWishlist(data.wishlist_id);
    const item = wishlist && getSharedWishlistItem(wishlist, itemId);
    if (!wishlist || !wishlist.prices_visible || !item || item.origin !== "external" || !item.product_url) {
      return pricingJson({ error: "Not found." }, 404);
    }
    return pricingJson(await getLinkedGiftEstimate(itemId, db));
  } catch (error) { return pricingFailure(error); }
}
