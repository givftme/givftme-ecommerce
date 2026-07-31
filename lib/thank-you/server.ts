import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPersonalThankYouEmail } from "@/lib/thank-you/buildThankYouEmail";
import { sendThankYouEmail } from "@/lib/email/resend";
import type { GiftReceived, GiftSource } from "@/lib/thank-you/types";

const CATALOG_LIVE_STATUSES = [
  "confirmed",
  "under_review",
  "forwarded",
  "shipped",
  "delivered",
];

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] || null : value;
}

interface ThankYouJoin {
  type: string;
  sent: boolean;
}

interface PurchaseRow {
  id: string;
  created_at: string;
  wishlist_item_id: string;
  buyer_id: string;
  thank_you_messages: ThankYouJoin[] | null;
}

interface OrderRow {
  id: string;
  created_at: string;
  wishlist_item_id: string | null;
  buyer_id: string;
  order_items: { product_title: string; product_image_url: string | null }[] | null;
  thank_you_messages: ThankYouJoin[] | null;
}

interface WishlistItemLookup {
  id: string;
  title: string;
  image_url: string | null;
}

function thankYouState(rows: ThankYouJoin[] | null) {
  const list = rows || [];
  return {
    autoThankYouSent: list.some((row) => row.type === "auto" && row.sent),
    personalThankYouSent: list.some((row) => row.type === "personal" && row.sent),
  };
}

// Fetches the receiver's own wishlist_item ids first, then filters
// purchases/orders with `.in()` rather than a nested `.eq('wishlist_items.
// wishlists.user_id', ...)` PostgREST filter — that nested-filter syntax has
// no precedent anywhere in this codebase and can't be verified against a
// live Supabase instance from this environment, while `.in()` filtering is
// already used extensively and proven to work.
export async function getGiftsReceived(
  supabase: SupabaseClient,
  userId: string
): Promise<GiftReceived[]> {
  const { data: wishlists, error: wishlistsError } = await supabase
    .from("wishlists")
    .select("id")
    .eq("user_id", userId);

  if (wishlistsError) {
    throw new Error(wishlistsError.message);
  }

  const wishlistIds = ((wishlists || []) as { id: string }[]).map((row) => row.id);

  if (wishlistIds.length === 0) {
    return [];
  }

  const { data: items, error: itemsError } = await supabase
    .from("wishlist_items")
    .select("id, title, image_url")
    .in("wishlist_id", wishlistIds);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const itemsById = new Map<string, WishlistItemLookup>(
    ((items || []) as WishlistItemLookup[]).map((item) => [item.id, item])
  );
  const itemIds = Array.from(itemsById.keys());

  if (itemIds.length === 0) {
    return [];
  }

  const [{ data: purchases, error: purchasesError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase
        .from("purchases")
        .select("id, created_at, wishlist_item_id, buyer_id, thank_you_messages(type, sent)")
        .in("wishlist_item_id", itemIds),
      supabase
        .from("orders")
        .select(
          "id, created_at, wishlist_item_id, buyer_id, order_items(product_title, product_image_url), thank_you_messages(type, sent)"
        )
        .in("wishlist_item_id", itemIds)
        .in("status", CATALOG_LIVE_STATUSES),
    ]);

  if (purchasesError) {
    throw new Error(purchasesError.message);
  }

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const buyerIds = new Set<string>();
  for (const row of (purchases || []) as PurchaseRow[]) buyerIds.add(row.buyer_id);
  for (const row of (orders || []) as OrderRow[]) buyerIds.add(row.buyer_id);

  const { data: buyers, error: buyersError } =
    buyerIds.size > 0
      ? await supabase.from("users").select("id, full_name").in("id", Array.from(buyerIds))
      : { data: [] as { id: string; full_name: string | null }[], error: null };

  if (buyersError) {
    throw new Error(buyersError.message);
  }

  const buyerNameById = new Map(
    ((buyers || []) as { id: string; full_name: string | null }[]).map((buyer) => [
      buyer.id,
      buyer.full_name,
    ])
  );

  const externalGifts: GiftReceived[] = ((purchases || []) as PurchaseRow[]).map((row) => {
    const item = itemsById.get(row.wishlist_item_id);

    return {
      id: row.id,
      source: "purchase" as GiftSource,
      itemTitle: item?.title || "your gift",
      itemImageUrl: item?.image_url || null,
      buyerName: buyerNameById.get(row.buyer_id) || null,
      purchasedAt: row.created_at,
      ...thankYouState(row.thank_you_messages),
    };
  });

  const catalogGifts: GiftReceived[] = ((orders || []) as OrderRow[]).map((row) => {
    const firstItem = (row.order_items || [])[0];

    return {
      id: row.id,
      source: "order" as GiftSource,
      itemTitle: firstItem?.product_title || "your gift",
      itemImageUrl: firstItem?.product_image_url || null,
      buyerName: buyerNameById.get(row.buyer_id) || null,
      purchasedAt: row.created_at,
      ...thankYouState(row.thank_you_messages),
    };
  });

  return [...externalGifts, ...catalogGifts].sort((a, b) =>
    b.purchasedAt.localeCompare(a.purchasedAt)
  );
}

type GiftOwnership =
  | { ok: true; buyerId: string; itemTitle: string }
  | { ok: false; status: number; error: string };

async function assertPurchaseOwnership(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<GiftOwnership> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, buyer_id, wishlist_items(title, wishlists(user_id))")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as {
    id: string;
    buyer_id: string;
    wishlist_items:
      | { title: string; wishlists: { user_id: string } | { user_id: string }[] | null }
      | { title: string; wishlists: { user_id: string } | { user_id: string }[] | null }[]
      | null;
  } | null;

  const wishlistItem = row ? first(row.wishlist_items) : null;
  const wishlist = wishlistItem ? first(wishlistItem.wishlists) : null;

  if (!row || !wishlistItem || !wishlist || wishlist.user_id !== userId) {
    return { ok: false, status: 404, error: "Gift not found." };
  }

  return { ok: true, buyerId: row.buyer_id, itemTitle: wishlistItem.title };
}

async function assertOrderOwnership(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<GiftOwnership> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, order_items(product_title), wishlist_items(wishlists(user_id))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as {
    id: string;
    buyer_id: string;
    order_items: { product_title: string }[] | null;
    wishlist_items:
      | { wishlists: { user_id: string } | { user_id: string }[] | null }
      | { wishlists: { user_id: string } | { user_id: string }[] | null }[]
      | null;
  } | null;

  const wishlistItem = row ? first(row.wishlist_items) : null;
  const wishlist = wishlistItem ? first(wishlistItem.wishlists) : null;

  if (!row || !wishlistItem || !wishlist || wishlist.user_id !== userId) {
    return { ok: false, status: 404, error: "Gift not found." };
  }

  const itemTitle = first(row.order_items)?.product_title || "your gift";

  return { ok: true, buyerId: row.buyer_id, itemTitle };
}

export async function assertReceiverOwnsGift(
  supabase: SupabaseClient,
  { id, source, userId }: { id: string; source: GiftSource; userId: string }
): Promise<GiftOwnership> {
  return source === "purchase"
    ? assertPurchaseOwnership(supabase, id, userId)
    : assertOrderOwnership(supabase, id, userId);
}

// `serviceClient` is only needed for the `auth.admin.getUserById` lookup —
// buyer email lives on `auth.users`, never mirrored to `public.users`, so
// even this receiver-initiated route needs a service-role client for that
// one call. The actual insert still goes through the regular `supabase`
// client so RLS stays the enforced boundary on who can write this row.
export async function sendPersonalThankYou({
  supabase,
  serviceClient,
  userId,
  receiverName,
  id,
  source,
  message,
}: {
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
  userId: string;
  receiverName: string;
  id: string;
  source: GiftSource;
  message: string;
}): Promise<GiftOwnership> {
  const ownership = await assertReceiverOwnsGift(supabase, { id, source, userId });

  if (!ownership.ok) {
    return ownership;
  }

  const { data: buyerAuth } = await serviceClient.auth.admin.getUserById(ownership.buyerId);
  const buyerEmail = buyerAuth?.user?.email;

  if (!buyerEmail) {
    throw new Error("Couldn't send your message. Please try again.");
  }

  const email = buildPersonalThankYouEmail({
    message,
    receiverName,
    itemTitle: ownership.itemTitle,
  });

  const result = await sendThankYouEmail({ to: buyerEmail, ...email });

  if (!result.sent) {
    throw new Error("Couldn't send your message. Please try again.");
  }

  const insertPayload = {
    purchase_id: source === "purchase" ? id : null,
    order_id: source === "order" ? id : null,
    receiver_id: userId,
    buyer_id: ownership.buyerId,
    type: "personal",
    message,
    sent: true,
    sent_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from("thank_you_messages").insert(insertPayload);

  if (insertError) {
    // The email genuinely sent — recording it failing shouldn't surface as a
    // send failure to the user, just gets logged so the "sent" chip may not
    // show up until this is investigated.
    console.error("Personal thank-you sent but recording it failed.", insertError);
  }

  return ownership;
}
