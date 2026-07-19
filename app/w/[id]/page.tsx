import { notFound } from "next/navigation";
import { SharedWishlistClient } from "@/components/wishlist/SharedWishlistClient";
import { getSharedWishlist } from "@/lib/wishlist/shared";

export const dynamic = "force-dynamic";

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, wishlist } = await getSharedWishlist(id);

  if (!wishlist) {
    notFound();
  }

  return (
    <SharedWishlistClient
      wishlist={wishlist}
      isAuthenticated={Boolean(user)}
    />
  );
}
