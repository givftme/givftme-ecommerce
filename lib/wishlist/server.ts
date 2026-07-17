import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getWishlistStoragePathFromImageRef,
  WISHLIST_IMAGES_BUCKET,
} from "@/lib/wishlist/images";
import type { WishlistDetail, WishlistItem, WishlistSummary } from "@/lib/wishlist/types";

type EvergreenWishlist = Omit<WishlistSummary, "item_count">;

interface WishlistDetailSelectOptions {
  includeDescription: boolean;
  includeSortOrder: boolean;
  includeMasterItemId: boolean;
}

const EVERGREEN_WISHLIST_SELECT = "id, title, type, visibility, prices_visible";
const WISHLIST_ITEMS_RELATION = "wishlist_items_with_status";
const WISHLIST_IMAGE_SIGNED_URL_TTL = 60 * 60;

function isRlsViolation(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42501" ||
    error?.message?.toLowerCase().includes("row-level security")
  );
}

function assertEvergreenWishlist(
  wishlist: Partial<EvergreenWishlist> | null,
  message: string
): EvergreenWishlist {
  if (!wishlist?.id) {
    throw new Error(message);
  }

  return wishlist as EvergreenWishlist;
}

export async function requireDashboardUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/wishlists");
  }

  return { supabase, user };
}

export async function ensureEvergreenWishlist(
  supabase: SupabaseClient,
  userId: string
) {
  const { data: existing, error: existingError } = await supabase
    .from("wishlists")
    .select(EVERGREEN_WISHLIST_SELECT)
    .eq("user_id", userId)
    .eq("type", "evergreen")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return assertEvergreenWishlist(
      existing as EvergreenWishlist,
      "Evergreen wishlist exists but did not include a valid ID."
    );
  }

  const { data: created, error: createError } = await supabase
    .from("wishlists")
    .insert({
      user_id: userId,
      title: "My Wishlist",
      type: "evergreen",
      visibility: "private",
      prices_visible: true,
    })
    .select(EVERGREEN_WISHLIST_SELECT)
    .single();

  if (!createError) {
    return assertEvergreenWishlist(
      created as EvergreenWishlist | null,
      "Could not create a valid evergreen wishlist."
    );
  }

  if (createError?.code === "23505") {
    const { data: racedWishlist, error: racedError } = await supabase
      .from("wishlists")
      .select(EVERGREEN_WISHLIST_SELECT)
      .eq("user_id", userId)
      .eq("type", "evergreen")
      .single();

    if (racedError) {
      throw new Error(racedError.message);
    }

    return assertEvergreenWishlist(
      racedWishlist as EvergreenWishlist | null,
      "Evergreen wishlist already exists but could not be loaded."
    );
  }

  if (isRlsViolation(createError)) {
    throw new Error(
      "Supabase RLS rejected evergreen wishlist creation. Apply gifvtme_migration_004_wishlist_rls.sql so authenticated owners can insert their own wishlists."
    );
  }

  throw new Error(createError?.message || "Could not create evergreen wishlist.");
}

export async function getWishlistSummaries(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("wishlists")
    .select("id, title, type, visibility, prices_visible, wishlist_items(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((wishlist) => {
    const row = wishlist as Omit<WishlistSummary, "item_count"> & {
      wishlist_items?: Array<{ id: string }>;
    };

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      visibility: row.visibility,
      prices_visible: row.prices_visible,
      item_count: row.wishlist_items?.length || 0,
    };
  });
}

function bySortOrderThenCreatedAt(a: WishlistItem, b: WishlistItem) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return (a.created_at || "").localeCompare(b.created_at || "");
}

export async function signWishlistImage<T extends { image_url: string | null }>(
  supabase: SupabaseClient,
  userId: string,
  item: T
): Promise<T & { image_storage_path?: string | null }> {
  const storagePath = getWishlistStoragePathFromImageRef(item.image_url);

  if (!storagePath) {
    return { ...item, image_storage_path: null };
  }

  if (!storagePath.startsWith(`${userId}/`)) {
    return { ...item, image_url: null, image_storage_path: storagePath };
  }

  const { data, error } = await supabase.storage
    .from(WISHLIST_IMAGES_BUCKET)
    .createSignedUrl(storagePath, WISHLIST_IMAGE_SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    console.error("Could not create signed wishlist image URL.", error);
    return { ...item, image_url: null, image_storage_path: storagePath };
  }

  return {
    ...item,
    image_url: data.signedUrl,
    image_storage_path: storagePath,
  };
}

export async function signWishlistImages<T extends { image_url: string | null }>(
  supabase: SupabaseClient,
  userId: string,
  items: T[]
) {
  return Promise.all(items.map((item) => signWishlistImage(supabase, userId, item)));
}

function isMissingColumn(
  error: { message?: string } | null,
  column: string
) {
  return error?.message?.toLowerCase().includes(column.toLowerCase()) ?? false;
}

function getWishlistDetailSelect({
  includeDescription,
  includeSortOrder,
  includeMasterItemId,
}: WishlistDetailSelectOptions) {
  const itemColumns = [
    "id",
    "wishlist_id",
    ...(includeMasterItemId ? ["master_item_id"] : []),
    "title",
    "image_url",
    "product_url",
    "affiliate_url",
    "price",
    ...(includeDescription ? ["description"] : []),
    "origin",
    "catalog_product_id",
    "status",
    "is_exclusive",
    ...(includeSortOrder ? ["sort_order"] : []),
    "created_at",
    "affiliate_purchased_at",
    "order_status",
  ];

  return `
    id,
    title,
    type,
    visibility,
    prices_visible,
    wishlist_items_with_status (
${itemColumns.map((column) => `      ${column}`).join(",\n")}
    )
  `;
}

export async function getOwnedWishlistDetail(
  supabase: SupabaseClient,
  userId: string,
  wishlistId: string
): Promise<WishlistDetail | null> {
  const selectOptions: WishlistDetailSelectOptions = {
    includeDescription: true,
    includeSortOrder: true,
    includeMasterItemId: true,
  };
  const fetchWishlist = () => {
    let query = supabase
      .from("wishlists")
      .select(getWishlistDetailSelect(selectOptions))
      .eq("id", wishlistId)
      .eq("user_id", userId);

    if (selectOptions.includeSortOrder) {
      query = query.order("sort_order", {
        referencedTable: WISHLIST_ITEMS_RELATION,
        ascending: true,
      });
    }

    return query
      .order("created_at", {
        referencedTable: WISHLIST_ITEMS_RELATION,
        ascending: true,
      })
      .maybeSingle();
  };

  let response = await fetchWishlist();

  while (response.error) {
    let shouldRetry = false;

    if (
      selectOptions.includeDescription &&
      isMissingColumn(response.error, "description")
    ) {
      console.error(
        "wishlist_items_with_status.description is missing. Re-run gifvtme_migration_004_wishlist_rls.sql to repair the view."
      );
      selectOptions.includeDescription = false;
      shouldRetry = true;
    }

    if (
      selectOptions.includeSortOrder &&
      isMissingColumn(response.error, "sort_order")
    ) {
      console.error(
        "wishlist_items.sort_order is missing. Run gifvtme_migration_003.sql before using reorder."
      );
      selectOptions.includeSortOrder = false;
      shouldRetry = true;
    }

    if (
      selectOptions.includeMasterItemId &&
      isMissingColumn(response.error, "master_item_id")
    ) {
      console.error(
        "wishlist_items_with_status.master_item_id is missing. Run gifvtme_migration_005_occasion_wishlist.sql before using occasion wishlist pulls."
      );
      selectOptions.includeMasterItemId = false;
      shouldRetry = true;
    }

    if (!shouldRetry) {
      break;
    }

    response = await fetchWishlist();
  }

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (!response.data) {
    return null;
  }

  const row = response.data as unknown as Omit<WishlistDetail, "items"> & {
    wishlist_items_with_status?: Array<Partial<WishlistItem>>;
  };

  const items = (row.wishlist_items_with_status || [])
    .map((item) => ({
      id: item.id || "",
      wishlist_id: item.wishlist_id || row.id,
      master_item_id: item.master_item_id || null,
      title: item.title || "",
      image_url: item.image_url || null,
      product_url: item.product_url || null,
      affiliate_url: item.affiliate_url || null,
      price: item.price ?? null,
      description: item.description || null,
      origin: item.origin || "external",
      catalog_product_id: item.catalog_product_id || null,
      status: item.status || "available",
      is_exclusive: Boolean(item.is_exclusive),
      sort_order: item.sort_order ?? 0,
      created_at: item.created_at || null,
      affiliate_purchased_at: item.affiliate_purchased_at || null,
      order_status: item.order_status || null,
      buyer_name: item.buyer_name || null,
    }))
    .filter((item) => item.status !== "archived")
    .sort(bySortOrderThenCreatedAt);

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    visibility: row.visibility,
    prices_visible: row.prices_visible,
    items: await signWishlistImages(supabase, userId, items),
  };
}

export async function getAuthenticatedApiUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user as User | null;
}

export async function assertWishlistOwner(
  supabase: SupabaseClient,
  wishlistId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("wishlists")
    .select("id, user_id, type")
    .eq("id", wishlistId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { ok: false as const, status: 404, error: "Wishlist not found." };
  }

  const wishlist = data as { id: string; user_id: string; type: string };

  if (wishlist.user_id !== userId) {
    return { ok: false as const, status: 404, error: "Wishlist not found." };
  }

  return { ok: true as const, wishlist };
}

export async function getNextSortOrder(
  supabase: SupabaseClient,
  wishlistId: string
) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("sort_order")
    .eq("wishlist_id", wishlistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error?.message.toLowerCase().includes("sort_order")) {
    console.error(
      "wishlist_items.sort_order is missing. Run gifvtme_migration_003.sql before adding reorderable items."
    );

    return 0;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
}
