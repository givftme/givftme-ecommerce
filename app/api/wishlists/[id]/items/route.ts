import { NextResponse } from "next/server";
import { buildAffiliateUrl } from "@/lib/affiliate/transform";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { normalizeWishlistImageRef } from "@/lib/wishlist/images";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
  getNextSortOrder,
  getOwnedWishlistDetail,
  signWishlistImage,
} from "@/lib/wishlist/server";
import { externalWishlistItemSchema } from "@/lib/wishlist/validation";

interface WishlistItemsRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: WishlistItemsRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const wishlist = await getOwnedWishlistDetail(supabase, user.id, id);

    if (!wishlist) {
      return jsonError("Wishlist not found.", 404);
    }

    return NextResponse.json({ items: wishlist.items });
  } catch {
    return jsonError("Couldn't load wishlist items.", 500);
  }
}

export async function POST(request: Request, context: WishlistItemsRouteContext) {
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
  const parsed = externalWishlistItemSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check the item details and try again.", 400);
  }

  const imageUrl = normalizeWishlistImageRef(parsed.data.image_url, user.id);

  if (parsed.data.image_url && imageUrl === null) {
    return jsonError("You cannot use that image.", 400);
  }

  let nextSortOrder = 0;

  try {
    nextSortOrder = await getNextSortOrder(supabase, id);
  } catch {
    return jsonError("Couldn't prepare item order.", 500);
  }
  const { affiliateUrl } = buildAffiliateUrl(parsed.data.product_url);
  const isExclusive = owner.wishlist.type === "occasion" && parsed.data.is_exclusive;
  const insertPayload = {
    wishlist_id: id,
    origin: "external",
    master_item_id: null,
    title: parsed.data.title,
    image_url: imageUrl,
    product_url: parsed.data.product_url,
    affiliate_url: affiliateUrl,
    price: parsed.data.price,
    description: parsed.data.description,
    is_exclusive: isExclusive,
    sort_order: nextSortOrder,
  };

  let payloadToInsert: Partial<typeof insertPayload> = insertPayload;
  let insert = await supabase.from("wishlist_items").insert(payloadToInsert).select().single();

  while (
    insert.error?.message.toLowerCase().includes("sort_order") ||
    insert.error?.message.toLowerCase().includes("master_item_id")
  ) {
    const message = insert.error.message.toLowerCase();
    const missingKey = message.includes("sort_order")
      ? "sort_order"
      : "master_item_id";

    if (!(missingKey in payloadToInsert)) {
      break;
    }

    console.error(
      missingKey === "sort_order"
        ? "wishlist_items.sort_order is missing. Run gifvtme_migration_003.sql before using reorder."
        : "wishlist_items.master_item_id is missing. Run gifvtme_migration_005_occasion_wishlist.sql before using occasion pulls."
    );

    payloadToInsert = Object.fromEntries(
      Object.entries(payloadToInsert).filter(([key]) => key !== missingKey)
    ) as Partial<typeof insertPayload>;

    insert = await supabase.from("wishlist_items").insert(payloadToInsert).select().single();
  }

  if (insert.error || !insert.data) {
    return jsonError("Couldn't save item. Try again.", 500);
  }

  if (owner.wishlist.type === "evergreen") {
    const masterPayload = {
      user_id: user.id,
      title: parsed.data.title,
      image_url: imageUrl,
      product_url: parsed.data.product_url,
      price: parsed.data.price,
      origin: "external",
      sort_order: nextSortOrder,
    };

    let masterInsert = await supabase.from("master_items").insert(masterPayload);

    if (masterInsert.error?.message.toLowerCase().includes("sort_order")) {
      const payloadWithoutSortOrder: Omit<typeof masterPayload, "sort_order"> =
        Object.fromEntries(
          Object.entries(masterPayload).filter(([key]) => key !== "sort_order")
        ) as Omit<typeof masterPayload, "sort_order">;
      masterInsert = await supabase.from("master_items").insert(payloadWithoutSortOrder);
    }

    if (masterInsert.error) {
      return jsonError("Item saved, but couldn't update the evergreen pool.", 500);
    }
  }

  const item = await signWishlistImage(
    supabase,
    user.id,
    insert.data as { image_url: string | null }
  );

  return NextResponse.json({ item }, { status: 201 });
}
