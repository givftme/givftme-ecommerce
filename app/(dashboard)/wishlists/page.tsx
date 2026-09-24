import { redirect } from "next/navigation";
import {
  ensureEvergreenWishlist,
  requireDashboardUser,
} from "@/lib/wishlist/server";

// The wishlists screen is one page: the "My wishlists" sidebar beside the
// selected list. Landing here opens the evergreen list, which always exists.
export default async function DashboardWishlistsPage() {
  const { supabase, user } = await requireDashboardUser();
  const evergreen = await ensureEvergreenWishlist(supabase, user.id);

  redirect(`/wishlists/${evergreen.id}`);
}
