import { notFound, redirect } from "next/navigation";
import { GiftCheckoutForm } from "@/components/checkout/GiftCheckoutForm";
import { withRedirect } from "@/lib/auth/redirect";
import { resolveGiftProduct } from "@/lib/gift/catalog";
import { getActiveClaim } from "@/lib/gift/server";
import type { GiftCheckoutContext } from "@/lib/gift/types";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/wishlist/display";
import { getSharedWishlist, getSharedWishlistItem } from "@/lib/wishlist/shared";

export const dynamic = "force-dynamic";

/**
 * Gift checkout, behind the authentication boundary.
 *
 * Reaching this page proves nothing on its own. The claim is resolved from
 * the session, so a buyer who types this URL without holding a reservation
 * is sent back to the item rather than shown a checkout they cannot
 * complete (spec AC-1).
 */
export default async function GiftCheckoutPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const detailPath = `/w/${id}/item/${itemId}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", `/w/${id}/gift/${itemId}/checkout`));
  }

  const { wishlist } = await getSharedWishlist(id);

  if (!wishlist) {
    notFound();
  }

  const item = getSharedWishlistItem(wishlist, itemId);

  if (!item) {
    notFound();
  }

  // External gifts never enter catalogue checkout. They keep the affiliate
  // redirect and purchase marking path (spec AC-26).
  if (item.origin !== "catalog" || !item.catalog_product_id) {
    redirect(detailPath);
  }

  const claim = await getActiveClaim(supabase, itemId);

  if (!claim || claim.wishlist_id !== wishlist.id) {
    redirect(detailPath);
  }

  const resolved = await resolveGiftProduct(item.catalog_product_id, null);

  if (!resolved) {
    redirect(detailPath);
  }

  // Slice 1 of spec 0002 deliberately runs the AC-25 path: no owner set
  // destination exists yet, so the order is paid for and held. Slice 2
  // adds wishlist_delivery_destinations and swaps these four fields for
  // the real projection.
  const context: GiftCheckoutContext = {
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
  };

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = (profile as { full_name?: string | null } | null)?.full_name ?? "";
  const [firstName = "", ...restOfName] = fullName.trim().split(/\s+/);

  return (
    <GiftCheckoutForm
      context={context}
      receiverName={getDisplayName(wishlist.owner.full_name)}
      initialEmail={
        (profile as { email?: string | null } | null)?.email ?? user.email ?? ""
      }
      initialFirstName={firstName}
      initialLastName={restOfName.join(" ")}
      backHref={detailPath}
    />
  );
}
