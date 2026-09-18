import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { resolveGiftProduct } from "@/lib/gift/catalog";
import { getActiveClaim } from "@/lib/gift/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface GiftContextRouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * Everything gift checkout needs, and deliberately nothing more.
 *
 * The recipient's street address, apartment, phone and delivery
 * instructions are never in this response. A buyer sees a first name, a
 * city and a state, which is enough to know the gift is going to the right
 * person and not enough to turn up at their door (spec AC-22).
 *
 * Only the claim holder may read this. The claim is resolved from the
 * session, so the route params cannot be used to read somebody else's
 * purchase.
 */
export async function GET(_request: Request, context: GiftContextRouteContext) {
  const { id: wishlistId, itemId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const claim = await getActiveClaim(supabase, itemId);

  if (!claim) {
    return jsonError("You don't have this gift reserved.", 409);
  }

  if (claim.wishlist_id !== wishlistId) {
    return jsonError("We couldn't find that gift.", 404);
  }

  const { data: itemRow, error: itemError } = await supabase
    .from("wishlist_items_with_status")
    .select("id, origin, status, catalog_product_id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) {
    return jsonError("Couldn't load this gift.", 500);
  }

  const item = itemRow as {
    id: string;
    origin: string;
    status: string;
    catalog_product_id: string | null;
  } | null;

  if (!item) {
    return jsonError("We couldn't find that gift.", 404);
  }

  if (item.origin !== "catalog" || !item.catalog_product_id) {
    return jsonError("External gifts do not use checkout.", 400);
  }

  const resolved = await resolveGiftProduct(item.catalog_product_id, null);

  if (!resolved) {
    return jsonError("This gift is no longer available.", 409);
  }

  // Slice 1 runs the AC-25 path on purpose: there is no owner set
  // destination yet, so the order is created and paid for, then held for
  // fulfilment rather than failing. wishlist_delivery_destinations and its
  // projection function arrive with migration 028 (spec slice 2), and this
  // is the one place that will need to change.
  return NextResponse.json({
    wishlist_id: claim.wishlist_id,
    wishlist_item_id: claim.wishlist_item_id,
    claim_id: claim.claim_id,
    claim_expires_at: claim.expires_at,
    catalog_product_id: item.catalog_product_id,
    combination_key: null,
    product_title: resolved.product_title,
    product_image_url: resolved.product_image_url,
    unit_price: resolved.unit_price,
    recipient_first_name: null,
    recipient_city: null,
    recipient_state: null,
    has_destination: false,
  });
}
