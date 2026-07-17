import { notFound } from "next/navigation";
import { WishlistItemList } from "@/components/wishlist/WishlistItemList";
import { trackEvent } from "@/lib/analytics";
import { getOwnedWishlistDetail, requireDashboardUser } from "@/lib/wishlist/server";

export default async function WishlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireDashboardUser(`/wishlists/${id}`);
  const wishlist = await getOwnedWishlistDetail(supabase, user.id, id);

  if (!wishlist) {
    notFound();
  }

  trackEvent("wishlist.viewed", {
    wishlist_id: wishlist.id,
    item_count: wishlist.items.length,
  });

  return <WishlistItemList wishlist={wishlist} />;
}
