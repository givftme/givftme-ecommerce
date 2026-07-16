import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { normalizeWishlistImageRef } from "@/lib/wishlist/images";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
  signWishlistImage,
} from "@/lib/wishlist/server";
import { editWishlistItemSchema } from "@/lib/wishlist/validation";

interface WishlistItemRouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(request: Request, context: WishlistItemRouteContext) {
  const { id, itemId } = await context.params;
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
  const parsed = editWishlistItemSchema.safeParse(body);

  if (!parsed.success || !body || typeof body !== "object") {
    return jsonError("Check the item details and try again.", 400);
  }

  const input = body as Record<string, unknown>;
  const updates: Record<string, string | number | null> = {};

  if ("title" in input && parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
  }

  if ("image_url" in input) {
    const imageUrl = normalizeWishlistImageRef(parsed.data.image_url, user.id);

    if (parsed.data.image_url && imageUrl === null) {
      return jsonError("You cannot use that image.", 400);
    }

    updates.image_url = imageUrl;
  }

  if ("price" in input) {
    updates.price = parsed.data.price ?? null;
  }

  if ("description" in input) {
    updates.description = parsed.data.description ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No changes provided.", 400);
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .update(updates)
    .eq("id", itemId)
    .eq("wishlist_id", id)
    .select()
    .single();

  if (error) {
    return jsonError("Couldn't save changes. Try again.", 500);
  }

  const item = await signWishlistImage(
    supabase,
    user.id,
    data as { image_url: string | null }
  );

  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, context: WishlistItemRouteContext) {
  const { id, itemId } = await context.params;
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
    .from("wishlist_items")
    .update({ status: "archived" })
    .eq("id", itemId)
    .eq("wishlist_id", id);

  if (error) {
    return jsonError("Couldn't delete item. Try again.", 500);
  }

  return new NextResponse(null, { status: 204 });
}
