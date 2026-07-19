import type { User } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { signWishlistImages } from "@/lib/wishlist/server";
import type {
  SharedWishlist,
  SharedWishlistOccasion,
  SharedWishlistOwner,
  WishlistInvite,
  WishlistItem,
  WishlistVisibility,
} from "@/lib/wishlist/types";

type JsonRecord = Record<string, unknown>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function asVisibility(value: unknown): WishlistVisibility {
  if (
    value === "private" ||
    value === "friends_family" ||
    value === "public"
  ) {
    return value;
  }

  return "private";
}

function normalizeInvite(value: unknown): WishlistInvite | null {
  if (!value) {
    return null;
  }

  const row = asRecord(value);
  const id = asString(row.id);
  const wishlistId = asString(row.wishlist_id);
  const token = asString(row.token);

  if (!id || !wishlistId || !token) {
    return null;
  }

  return {
    id,
    wishlist_id: wishlistId,
    inviter_user_id: asString(row.inviter_user_id),
    invitee_email: asString(row.invitee_email),
    invitee_phone: asString(row.invitee_phone),
    invitee_user_id: asString(row.invitee_user_id),
    token,
    reminder_opted_in: asBoolean(row.reminder_opted_in),
    accepted_at: asString(row.accepted_at),
    created_at: asString(row.created_at),
  };
}

function normalizeOwner(value: unknown): SharedWishlistOwner | null {
  const row = asRecord(value);
  const id = asString(row.id);

  if (!id) {
    return null;
  }

  return {
    id,
    full_name: asString(row.full_name),
    avatar_url: asString(row.avatar_url),
  };
}

function normalizeOccasion(value: unknown): SharedWishlistOccasion | null {
  if (!value) {
    return null;
  }

  const row = asRecord(value);
  const id = asString(row.id);
  const title = asString(row.title);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    occasion_type: asString(row.occasion_type),
    occasion_date: asString(row.occasion_date),
  };
}

function normalizeItem(value: unknown, wishlistId: string): WishlistItem {
  const row = asRecord(value);

  return {
    id: asString(row.id) || "",
    wishlist_id: asString(row.wishlist_id) || wishlistId,
    master_item_id: asString(row.master_item_id),
    title: asString(row.title) || "",
    image_url: asString(row.image_url),
    product_url: asString(row.product_url),
    affiliate_url: asString(row.affiliate_url),
    price: asNumber(row.price),
    description: asString(row.description),
    origin: row.origin === "catalog" ? "catalog" : "external",
    catalog_product_id: asString(row.catalog_product_id),
    status: row.status === "purchased" ? "purchased" : "available",
    is_exclusive: asBoolean(row.is_exclusive),
    sort_order: asNumber(row.sort_order) ?? 0,
    created_at: asString(row.created_at),
    intent_flagged_by: asString(row.intent_flagged_by),
    intent_flagged_at: asString(row.intent_flagged_at),
    affiliate_purchased_at: asString(row.affiliate_purchased_at),
    order_status: asString(row.order_status),
    buyer_name: asString(row.buyer_name),
  };
}

function normalizeSharedWishlist(
  payload: unknown,
  shareId: string,
  viewerId: string | null
): SharedWishlist | null {
  const root = asRecord(payload);
  const wishlist = asRecord(root.wishlist);
  const id = asString(wishlist.id);
  const owner = normalizeOwner(wishlist.owner);

  if (!id || !owner) {
    return null;
  }

  const itemValues = Array.isArray(wishlist.items) ? wishlist.items : [];

  return {
    id,
    title: asString(wishlist.title) || "Wishlist",
    visibility: asVisibility(wishlist.visibility),
    prices_visible: asBoolean(wishlist.prices_visible, true),
    owner,
    occasion: normalizeOccasion(wishlist.occasion),
    items: itemValues
      .map((item) => normalizeItem(item, id))
      .filter((item) => item.id),
    invite: normalizeInvite(root.invite),
    share_id: shareId,
    viewer_is_owner: owner.id === viewerId,
  };
}

async function signSharedImages(wishlist: SharedWishlist) {
  try {
    const serviceClient = createServiceClient();
    const items = await signWishlistImages(
      serviceClient,
      wishlist.owner.id,
      wishlist.items
    );

    return { ...wishlist, items };
  } catch (error) {
    console.error("Could not sign shared wishlist images.", error);
    return wishlist;
  }
}

async function autoAcceptInvite({
  invite,
  user,
}: {
  invite: WishlistInvite | null;
  user: User | null;
}) {
  if (!invite || !user || invite.invitee_user_id) {
    return;
  }

  try {
    const supabase = await createClient();
    await supabase.rpc("gifvtme_accept_wishlist_invite", {
      p_invite_id: invite.id,
    });
  } catch (error) {
    console.error("Could not auto-accept wishlist invite.", error);
  }
}

export async function getSharedWishlist(shareId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("gifvtme_get_shared_wishlist", {
    p_share_key: shareId,
  });

  if (error || !data) {
    if (error) {
      console.error("Could not resolve shared wishlist.", error);
    }

    return { user, wishlist: null };
  }

  const normalized = normalizeSharedWishlist(data, shareId, user?.id || null);

  if (!normalized) {
    return { user, wishlist: null };
  }

  await autoAcceptInvite({ invite: normalized.invite, user });

  return {
    user,
    wishlist: await signSharedImages(normalized),
  };
}

export function getSharedWishlistItem(
  wishlist: SharedWishlist,
  itemId: string
) {
  return wishlist.items.find((item) => item.id === itemId) || null;
}

export function buildWishlistShareUrl(shareId: string) {
  return `${getAppUrl()}/w/${shareId}`;
}

export function buildExternalGiftUrl(item: WishlistItem) {
  const destination = item.affiliate_url || item.product_url;

  if (!destination) {
    return null;
  }

  if (item.affiliate_url) {
    return item.affiliate_url;
  }

  try {
    const url = new URL(destination);
    url.searchParams.set("utm_source", "gifvtme");
    url.searchParams.set("utm_medium", "wishlist");
    url.searchParams.set("utm_campaign", "gift_claim");

    return url.toString();
  } catch {
    return destination;
  }
}

export function isUuidLike(value: string) {
  return uuidPattern.test(value);
}
