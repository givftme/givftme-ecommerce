import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAffiliateUrl } from "@/lib/affiliate/transform";
import { isFutureDateOnly } from "@/lib/occasion/date";
import type {
  MasterItem,
  OccasionDetail,
  OccasionRecord,
  OccasionSummary,
} from "@/lib/occasion/types";
import type { CreateOccasionInput } from "@/lib/occasion/validation";
import {
  deleteUnsentOccasionReminders,
  scheduleOccasionReminders,
} from "@/lib/reminders/scheduleOccasionReminders";
import {
  getNextSortOrder,
  getOwnedWishlistDetail,
  signWishlistImages,
} from "@/lib/wishlist/server";
import type { WishlistItem } from "@/lib/wishlist/types";

interface OccasionWishlistRow {
  id: string;
  wishlist_items?: Array<{ id: string }>;
}

interface PulledMasterItemRow {
  id: string;
  origin: string;
  product_url: string | null;
}

interface TransactionalPulledItem {
  master_item_id: string;
  affiliate_url: string | null;
}

interface TransactionalExclusiveItem {
  title: string;
  image_url: string | null;
  product_url: string;
  affiliate_url: string;
  price: number | null;
  description: string | null;
}

interface TransactionalOccasionResult {
  occasion_id: string;
  wishlist_id: string;
}

function normalizeOccasion(row: Partial<OccasionRecord>): OccasionRecord {
  return {
    id: row.id || "",
    title: row.title || "",
    occasion_type: row.occasion_type || "other",
    occasion_date: row.occasion_date || "",
    status: row.status || "active",
    archived_at: row.archived_at || null,
  };
}

function normalizeMasterItem(row: Partial<MasterItem>): MasterItem {
  return {
    id: row.id || "",
    title: row.title || "",
    image_url: row.image_url || null,
    product_url: row.product_url || null,
    price: row.price ?? null,
    origin: row.origin || "external",
    catalog_product_id: row.catalog_product_id || null,
    status: row.status || null,
    sort_order: row.sort_order ?? 0,
  };
}

export async function getOccasionSummaries(
  supabase: SupabaseClient,
  userId: string
): Promise<OccasionSummary[]> {
  const { data, error } = await supabase
    .from("occasions")
    .select(
      `
        id,
        title,
        occasion_type,
        occasion_date,
        status,
        archived_at,
        wishlists (
          id,
          wishlist_items ( id )
        )
      `
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .map((row) => {
      const occasion = normalizeOccasion(row as Partial<OccasionRecord>);
      const wishlists = (row as { wishlists?: OccasionWishlistRow[] | OccasionWishlistRow })
        .wishlists;
      const wishlist = Array.isArray(wishlists) ? wishlists[0] : wishlists;

      return {
        ...occasion,
        wishlist_id: wishlist?.id || null,
        item_count: wishlist?.wishlist_items?.length || 0,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }

      if (a.status === "archived") {
        return (b.archived_at || "").localeCompare(a.archived_at || "");
      }

      return a.occasion_date.localeCompare(b.occasion_date);
    });
}

export async function getAvailableMasterItems(
  supabase: SupabaseClient,
  userId: string
): Promise<MasterItem[]> {
  const { data, error } = await supabase
    .from("master_items")
    .select("id, title, image_url, product_url, price, origin, catalog_product_id, status, sort_order")
    .eq("user_id", userId)
    .neq("status", "purchased")
    .neq("status", "archived")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return signWishlistImages(
    supabase,
    userId,
    (data || []).map((row) => normalizeMasterItem(row as Partial<MasterItem>))
  );
}

async function getOccasionWishlistId(
  supabase: SupabaseClient,
  occasionId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("wishlists")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "occasion")
    .eq("occasion_id", occasionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string } | null)?.id || null;
}

export async function getOwnedOccasionDetail(
  supabase: SupabaseClient,
  userId: string,
  occasionId: string
): Promise<OccasionDetail | null> {
  const { data: occasion, error } = await supabase
    .from("occasions")
    .select("id, title, occasion_type, occasion_date, status, archived_at")
    .eq("id", occasionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!occasion) {
    return null;
  }

  const wishlistId = await getOccasionWishlistId(supabase, occasionId, userId);

  if (!wishlistId) {
    return null;
  }

  const wishlist = await getOwnedWishlistDetail(supabase, userId, wishlistId);

  if (!wishlist) {
    return null;
  }

  const evergreenItems = await getAvailableMasterItems(supabase, userId);
  const purchasedPulledItems = wishlist.items.filter(
    (item) => item.master_item_id && item.status === "purchased"
  );
  const purchasedMasterIds = purchasedPulledItems
    .map((item) => item.master_item_id)
    .filter(Boolean) as string[];
  let reactivationItems = purchasedPulledItems;

  if (purchasedMasterIds.length > 0) {
    const { data: masterStatuses, error: masterStatusError } = await supabase
      .from("master_items")
      .select("id, status")
      .eq("user_id", userId)
      .in("id", purchasedMasterIds);

    if (masterStatusError) {
      throw new Error(masterStatusError.message);
    }

    const stillPurchasedIds = new Set(
      ((masterStatuses || []) as Array<{ id: string; status: string | null }>)
        .filter((item) => item.status === "purchased")
        .map((item) => item.id)
    );

    reactivationItems = purchasedPulledItems.filter(
      (item) => item.master_item_id && stillPurchasedIds.has(item.master_item_id)
    );
  }

  return {
    occasion: normalizeOccasion(occasion as Partial<OccasionRecord>),
    wishlist,
    evergreenItems,
    reactivationItems,
  };
}

export async function assertOccasionOwner(
  supabase: SupabaseClient,
  occasionId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("occasions")
    .select("id, user_id, title, occasion_type, occasion_date, status, archived_at")
    .eq("id", occasionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { ok: false as const, status: 404, error: "Occasion not found." };
  }

  const occasion = data as OccasionRecord & { user_id: string };

  if (occasion.user_id !== userId) {
    return { ok: false as const, status: 404, error: "Occasion not found." };
  }

  return { ok: true as const, occasion };
}

function itemFromMaster({
  masterItem,
  wishlistId,
  sortOrder,
}: {
  masterItem: MasterItem;
  wishlistId: string;
  sortOrder: number;
}) {
  const affiliateUrl =
    masterItem.origin === "external" && masterItem.product_url
      ? buildAffiliateUrl(masterItem.product_url).affiliateUrl
      : null;

  return {
    wishlist_id: wishlistId,
    master_item_id: masterItem.id,
    is_exclusive: false,
    origin: masterItem.origin,
    title: masterItem.title,
    image_url: masterItem.image_url,
    product_url: masterItem.product_url,
    affiliate_url: affiliateUrl,
    price: masterItem.price,
    catalog_product_id: masterItem.catalog_product_id,
    status: "available",
    sort_order: sortOrder,
  };
}

export async function insertPulledOccasionItems({
  supabase,
  userId,
  occasionId,
  pulledItemIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  occasionId: string;
  pulledItemIds: string[];
}): Promise<WishlistItem[]> {
  const wishlistId = await getOccasionWishlistId(supabase, occasionId, userId);

  if (!wishlistId || pulledItemIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(pulledItemIds)];
  const { data: existingRows, error: existingError } = await supabase
    .from("wishlist_items")
    .select("master_item_id")
    .eq("wishlist_id", wishlistId)
    .in("master_item_id", uniqueIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingIds = new Set(
    ((existingRows || []) as Array<{ master_item_id: string | null }>)
      .map((row) => row.master_item_id)
      .filter(Boolean)
  );
  const idsToAdd = uniqueIds.filter((id) => !existingIds.has(id));

  if (idsToAdd.length === 0) {
    return [];
  }

  const { data: masterItems, error: masterError } = await supabase
    .from("master_items")
    .select("id, title, image_url, product_url, price, origin, catalog_product_id, status, sort_order")
    .eq("user_id", userId)
    .in("id", idsToAdd)
    .neq("status", "purchased")
    .neq("status", "archived");

  if (masterError) {
    throw new Error(masterError.message);
  }

  const nextSortOrder = await getNextSortOrder(supabase, wishlistId);
  const payload = (masterItems || [])
    .map((row) => normalizeMasterItem(row as Partial<MasterItem>))
    .map((masterItem, index) =>
      itemFromMaster({
        masterItem,
        wishlistId,
        sortOrder: nextSortOrder + index,
      })
    );

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert(payload)
    .select()
    .returns<WishlistItem[]>();

  if (error) {
    throw new Error(error.message);
  }

  return signWishlistImages(supabase, userId, data || []);
}

export async function createOccasionWithWishlist({
  supabase,
  userId,
  input,
}: {
  supabase: SupabaseClient;
  userId: string;
  input: CreateOccasionInput;
}) {
  const uniquePulledItemIds = [...new Set(input.pulled_item_ids)];
  let pulledItems: TransactionalPulledItem[] = [];

  if (uniquePulledItemIds.length > 0) {
    const { data: masterItems, error: masterError } = await supabase
      .from("master_items")
      .select("id, origin, product_url")
      .eq("user_id", userId)
      .in("id", uniquePulledItemIds)
      .neq("status", "purchased")
      .neq("status", "archived")
      .returns<PulledMasterItemRow[]>();

    if (masterError) {
      throw new Error(masterError.message);
    }

    const masterItemsById = new Map((masterItems || []).map((item) => [item.id, item]));

    pulledItems = uniquePulledItemIds
      .map((id) => masterItemsById.get(id))
      .filter((item): item is PulledMasterItemRow => Boolean(item))
      .map((item) => ({
        master_item_id: item.id,
        affiliate_url:
          item.origin === "external" && item.product_url
            ? buildAffiliateUrl(item.product_url).affiliateUrl
            : null,
      }));
  }

  const exclusiveItems: TransactionalExclusiveItem[] = input.exclusive_items.map((item) => ({
    title: item.title,
    image_url: item.image_url,
    product_url: item.product_url,
    affiliate_url: buildAffiliateUrl(item.product_url).affiliateUrl,
    price: item.price,
    description: item.description,
  }));

  const { data, error } = await supabase
    .rpc("gifvtme_create_occasion_with_wishlist", {
      p_user_id: userId,
      p_title: input.title,
      p_occasion_type: input.occasion_type,
      p_occasion_date: input.occasion_date,
      p_pulled_items: pulledItems,
      p_exclusive_items: exclusiveItems,
    })
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create occasion.");
  }

  const result = data as TransactionalOccasionResult;

  if (isFutureDateOnly(input.occasion_date)) {
    try {
      await scheduleOccasionReminders({
        supabase,
        userId,
        occasionId: result.occasion_id,
        occasionDate: input.occasion_date,
      });
    } catch (error) {
      console.error("Occasion reminder scheduling failed.", error);
    }
  }

  return result;
}

export async function rescheduleOccasionReminders({
  supabase,
  userId,
  occasionId,
  occasionDate,
}: {
  supabase: SupabaseClient;
  userId: string;
  occasionId: string;
  occasionDate: string;
}) {
  await deleteUnsentOccasionReminders({ supabase, userId, occasionId });

  if (!isFutureDateOnly(occasionDate)) {
    return;
  }

  try {
    await scheduleOccasionReminders({ supabase, userId, occasionId, occasionDate });
  } catch (error) {
    console.error("Occasion reminder rescheduling failed.", error);
  }
}
