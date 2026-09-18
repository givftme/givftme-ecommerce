import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { claimWishlistItem, releaseWishlistItemClaim } from "@/lib/gift/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ClaimRouteContext {
  params: Promise<{ itemId: string }>;
}

/**
 * Reserving a gift. Authenticated only: the claim is what actually blocks
 * an item for other givers, so it needs a permanent account behind it that
 * support can reach if the gift goes wrong (spec AC-1, AC-15).
 *
 * The one-claim-per-item rule is a partial unique index, not a check in
 * here, so two simultaneous requests cannot both win.
 */
export async function POST(_request: Request, context: ClaimRouteContext) {
  const { itemId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const result = await claimWishlistItem(supabase, itemId);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({
    state: result.claim.state,
    expires_at: result.claim.expires_at,
    already_owned: result.claim.already_owned,
  });
}

/**
 * Releasing. Only the person who reserved can, and the SQL enforces that
 * by matching on claimant_user_id rather than trusting this handler.
 */
export async function DELETE(_request: Request, context: ClaimRouteContext) {
  const { itemId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const result = await releaseWishlistItemClaim(supabase, itemId);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ released: true });
}
