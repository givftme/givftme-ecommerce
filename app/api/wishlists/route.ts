import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  ensureEvergreenWishlist,
  getAuthenticatedApiUser,
  getWishlistSummaries,
} from "@/lib/wishlist/server";

const createWishlistSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  type: z.enum(["evergreen", "occasion"]).default("evergreen"),
});

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    await ensureEvergreenWishlist(supabase, user.id);
    const wishlists = await getWishlistSummaries(supabase, user.id);

    return NextResponse.json({ wishlists });
  } catch {
    return jsonError("Couldn't load wishlists.", 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = createWishlistSchema.safeParse(body || {});

  if (!parsed.success) {
    return jsonError("Invalid wishlist details.", 400);
  }

  if (parsed.data.type === "occasion") {
    return jsonError("Occasion wishlists are coming soon.", 400);
  }

  try {
    const wishlist = await ensureEvergreenWishlist(supabase, user.id);

    if (parsed.data.title && parsed.data.title !== wishlist.title) {
      const { data, error } = await supabase
        .from("wishlists")
        .update({ title: parsed.data.title })
        .eq("id", wishlist.id)
        .eq("user_id", user.id)
        .select("id, title, type, visibility, prices_visible")
        .single();

      if (error) {
        return jsonError("Couldn't update wishlist.", 500);
      }

      return NextResponse.json({ wishlist: data }, { status: 201 });
    }

    return NextResponse.json({ wishlist }, { status: 201 });
  } catch {
    return jsonError("Couldn't create wishlist.", 500);
  }
}
