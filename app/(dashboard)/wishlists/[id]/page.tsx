import { notFound } from "next/navigation";
import { WishlistItemList } from "@/components/wishlist/WishlistItemList";
import type { AddItemMode } from "@/components/wishlist/AddItemSheet";
import { trackEvent } from "@/lib/analytics";
import { getOwnedWishlistDetail, requireDashboardUser } from "@/lib/wishlist/server";

const ADD_MODES: AddItemMode[] = ["catalog", "url", "manual"];

function parseAddMode(value: string | string[] | undefined) {
  const mode = Array.isArray(value) ? value[0] : value;

  return ADD_MODES.includes(mode as AddItemMode)
    ? (mode as AddItemMode)
    : undefined;
}

export default async function WishlistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  const { id } = await params;
  const { add } = await searchParams;
  const { supabase, user } = await requireDashboardUser(`/wishlists/${id}`);
  const wishlist = await getOwnedWishlistDetail(supabase, user.id, id);

  if (!wishlist) {
    notFound();
  }

  trackEvent("wishlist.viewed", {
    wishlist_id: wishlist.id,
    item_count: wishlist.items.length,
  });

  return (
    <WishlistItemList wishlist={wishlist} initialAddMode={parseAddMode(add)} />
  );
}
