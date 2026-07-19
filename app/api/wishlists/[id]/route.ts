import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
} from "@/lib/wishlist/server";
import { wishlistUpdateSchema } from "@/lib/wishlist/validation";

interface WishlistRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: WishlistRouteContext) {
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
  const parsed = wishlistUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Invalid wishlist update.", 400);
  }

  const update = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.visibility !== undefined
      ? { visibility: parsed.data.visibility }
      : {}),
    ...(parsed.data.prices_visible !== undefined
      ? { prices_visible: parsed.data.prices_visible }
      : {}),
  };

  const { data, error } = await supabase
    .from("wishlists")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, type, visibility, prices_visible")
    .single();

  if (error) {
    return jsonError("Couldn't update wishlist.", 500);
  }

  return NextResponse.json({ wishlist: data });
}
