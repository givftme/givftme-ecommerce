import { NextResponse } from "next/server";
import { buildAffiliateUrl } from "@/lib/affiliate/transform";
import { readJson, jsonError } from "@/lib/api/response";
import { getActivePrice, isFlashSaleWindowActive } from "@/lib/flutterwave/getActivePrice";
import type { SanityCheckoutProduct } from "@/lib/flutterwave/getActivePrice";
import { sanityFetch } from "@/lib/sanity/fetch";
import { CART_PRICES_QUERY } from "@/lib/sanity/queries";
import { createClient } from "@/lib/supabase/server";
import { normalizeWishlistImageRef } from "@/lib/wishlist/images";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
  getNextSortOrder,
  getOwnedWishlistDetail,
  signWishlistImage,
} from "@/lib/wishlist/server";
import { wishlistItemCreateSchema } from "@/lib/wishlist/validation";

interface WishlistItemsRouteContext {
  params: Promise<{ id: string }>;
}

interface CatalogPriceProduct extends SanityCheckoutProduct {
  imageUrl?: string | null;
}

// No combination_key is collected at wishlist-add time, so variant products
// price as "from the cheapest available variant" rather than falling through
// to getActivePrice's unset basePrice (which would silently save price: 0).
function getFromPrice(product: CatalogPriceProduct): number | null {
  if (!product.hasVariants) {
    return getActivePrice(product, null);
  }

  if (isFlashSaleWindowActive(product) && product.salePrice != null) {
    return product.salePrice;
  }

  const availablePrices = (product.variants || [])
    .filter((variant) => variant.available !== false && variant.price != null)
    .map((variant) => variant.price as number);

  return availablePrices.length > 0 ? Math.min(...availablePrices) : null;
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
  const parsed = wishlistItemCreateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check the item details and try again.", 400);
  }

  let nextSortOrder = 0;

  try {
    nextSortOrder = await getNextSortOrder(supabase, id);
  } catch {
    return jsonError("Couldn't prepare item order.", 500);
  }

  const data = parsed.data;

  if (data.origin === "catalog") {
    let products: CatalogPriceProduct[];

    try {
      products = await sanityFetch<CatalogPriceProduct[]>(CART_PRICES_QUERY, {
        ids: [data.catalog_product_id],
      });
    } catch {
      return jsonError("Couldn't check that product right now. Try again.", 502);
    }
    const product = products.find((entry) => entry._id === data.catalog_product_id) ?? null;

    if (!product || product.status !== "active") {
      return jsonError("This product is no longer available.", 400);
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("wishlist_items")
      .select("id")
      .eq("wishlist_id", id)
      .eq("catalog_product_id", data.catalog_product_id)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      console.error("Couldn't check existing wishlist items.", duplicateError);
      return jsonError("Couldn't check existing wishlist items.", 500);
    }

    if (duplicate) {
      return jsonError("Already on this wishlist.", 409);
    }

    const catalogImageUrl = normalizeWishlistImageRef(
      product.imageUrl ?? null,
      user.id
    );
    const catalogPrice = getFromPrice(product);

    if (catalogPrice === null) {
      return jsonError("This product is currently unavailable.", 400);
    }

    const isExclusive = owner.wishlist.type === "occasion" && data.is_exclusive;
    const insertPayload = {
      wishlist_id: id,
      origin: "catalog",
      master_item_id: null,
      title: product.title,
      image_url: catalogImageUrl,
      product_url: null,
      affiliate_url: null,
      price: catalogPrice,
      description: data.description,
      catalog_product_id: data.catalog_product_id,
      is_exclusive: isExclusive,
      sort_order: nextSortOrder,
    };

    let payloadToInsert: Partial<typeof insertPayload> = insertPayload;
    let insert = await supabase
      .from("wishlist_items")
      .insert(payloadToInsert)
      .select()
      .single();

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

      insert = await supabase
        .from("wishlist_items")
        .insert(payloadToInsert)
        .select()
        .single();
    }

    if (insert.error?.code === "23505") {
      return jsonError("Already on this wishlist.", 409);
    }

    if (insert.error || !insert.data) {
      return jsonError("Couldn't save item. Try again.", 500);
    }

    if (owner.wishlist.type === "evergreen") {
      const masterPayload = {
        user_id: user.id,
        title: product.title,
        image_url: catalogImageUrl,
        product_url: null,
        price: catalogPrice,
        origin: "catalog",
        catalog_product_id: data.catalog_product_id,
        sort_order: nextSortOrder,
      };

      let masterInsert = await supabase.from("master_items").insert(masterPayload);

      if (masterInsert.error?.message.toLowerCase().includes("sort_order")) {
        const payloadWithoutSortOrder: Omit<typeof masterPayload, "sort_order"> =
          Object.fromEntries(
            Object.entries(masterPayload).filter(([key]) => key !== "sort_order")
          ) as Omit<typeof masterPayload, "sort_order">;
        masterInsert = await supabase
          .from("master_items")
          .insert(payloadWithoutSortOrder);
      }

      if (masterInsert.error) {
        return jsonError(
          "Item saved, but couldn't update the evergreen pool.",
          500
        );
      }
    }

    const item = await signWishlistImage(
      supabase,
      user.id,
      insert.data as { image_url: string | null }
    );

    return NextResponse.json({ item }, { status: 201 });
  }

  const imageUrl = normalizeWishlistImageRef(data.image_url, user.id);

  if (data.image_url && imageUrl === null) {
    return jsonError("You cannot use that image.", 400);
  }

  const { affiliateUrl } = buildAffiliateUrl(data.product_url);
  const isExclusive = owner.wishlist.type === "occasion" && data.is_exclusive;
  const insertPayload = {
    wishlist_id: id,
    origin: "external",
    master_item_id: null,
    title: data.title,
    image_url: imageUrl,
    product_url: data.product_url,
    affiliate_url: affiliateUrl,
    price: data.price,
    description: data.description,
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
      title: data.title,
      image_url: imageUrl,
      product_url: data.product_url,
      price: data.price,
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
