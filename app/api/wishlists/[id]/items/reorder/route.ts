import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
} from "@/lib/wishlist/server";
import { reorderWishlistItemsSchema } from "@/lib/wishlist/validation";

interface ReorderRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: ReorderRouteContext) {
  const { id } = await context.params;
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

  const body = await readJson(request);
  const parsed = reorderWishlistItemsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid item order.", 400);
  }

  // Requires gifvtme_migration_003.sql. Without wishlist_items.sort_order,
  // reordering cannot persist even though the list can still fall back to created_at.
  const updates = await Promise.all(
    parsed.data.ordered_ids.map((itemId, sortOrder) =>
      supabase
        .from("wishlist_items")
        .update({ sort_order: sortOrder })
        .eq("id", itemId)
        .eq("wishlist_id", id)
    )
  );

  const failed = updates.find((update) => update.error);

  if (failed?.error?.message.toLowerCase().includes("sort_order")) {
    return jsonError("Run wishlist sort_order migration before reordering.", 409);
  }

  if (failed?.error) {
    return jsonError("Couldn't save new order.", 500);
  }

  return NextResponse.json({ ok: true });
}
