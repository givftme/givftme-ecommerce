import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
} from "@/lib/wishlist/server";

interface WishlistInviteRouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

export async function DELETE(
  _request: Request,
  context: WishlistInviteRouteContext
) {
  const { id, inviteId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertWishlistOwner>>;

  try {
    owner = await assertWishlistOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify wishlist access.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  const { error } = await supabase
    .from("wishlist_invites")
    .delete()
    .eq("id", inviteId)
    .eq("wishlist_id", id);

  if (error) {
    return jsonError("Couldn't remove invite.", 500);
  }

  return NextResponse.json({ ok: true });
}
