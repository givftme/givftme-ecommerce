import { createServiceClient } from "@/lib/supabase/server";
import { asPoolStatus, type DashboardPool, type GiftPool, type PoolPageData, type PoolPerson } from "@/lib/pools/types";
import type { WishlistItem } from "@/lib/wishlist/types";
import { signWishlistImage } from "@/lib/wishlist/server";

type UnknownRow = Record<string, unknown>;

function asRecord(value: unknown): UnknownRow {
  return typeof value === "object" && value !== null
    ? value as UnknownRow
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizePool(rowValue: unknown): GiftPool {
  const row = asRecord(rowValue);
  return {
    id: String(row.id ?? ""),
    wishlist_id: String(row.wishlist_id ?? ""),
    wishlist_item_id: asString(row.wishlist_item_id),
    created_by: String(row.created_by ?? ""),
    receiver_id: String(row.receiver_id ?? ""),
    title: String(row.title ?? ""),
    message: asString(row.message),
    target_amount: asNumber(row.target_amount),
    amount_raised: asNumber(row.amount_raised),
    min_contribution: asNumber(row.min_contribution),
    token: String(row.token ?? ""),
    status: asPoolStatus(row.status),
    contributors_visible: row.contributors_visible !== false,
    fully_funded_at: asString(row.fully_funded_at),
    cashed_out_at: asString(row.cashed_out_at),
    cashed_out_amount: row.cashed_out_amount == null ? null : asNumber(row.cashed_out_amount),
    created_at: String(row.created_at ?? ""),
  };
}

function normalizePerson(rowValue: unknown, id: string): PoolPerson {
  const row = asRecord(rowValue);
  return {
    id,
    full_name: asString(row.full_name),
    avatar_url: asString(row.avatar_url),
  };
}

export async function getPoolPageData(token: string, viewerId: string | null): Promise<PoolPageData | null> {
  const service = createServiceClient();
  const { data: poolRow, error: poolError } = await service
    .from("group_gift_pools")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (poolError) throw poolError;
  if (!poolRow) return null;

  const pool = normalizePool(poolRow);
  const manager = viewerId === pool.receiver_id || viewerId === pool.created_by;
  const [wishlistResult, profilesResult, itemResult, progressResult] = await Promise.all([
    service.from("wishlists").select("id, title").eq("id", pool.wishlist_id).maybeSingle(),
    service.from("users").select("id, full_name, avatar_url").in("id", [pool.receiver_id, pool.created_by]),
    pool.wishlist_item_id
      ? service.from("wishlist_items").select("id, title, image_url, price, status").eq("id", pool.wishlist_item_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    service.from("group_gift_pool_progress").select("contributor_count")
      .eq("pool_id", pool.id).maybeSingle(),
  ]);

  if (wishlistResult.error || profilesResult.error || itemResult.error || progressResult.error) {
    throw wishlistResult.error || profilesResult.error || itemResult.error || progressResult.error;
  }

  const profileRows = (profilesResult.data ?? []) as UnknownRow[];
  const profileById = new Map(profileRows.map((row) => [String(row.id), row]));
  const receiver = normalizePerson(profileById.get(pool.receiver_id), pool.receiver_id);
  const creator = normalizePerson(profileById.get(pool.created_by), pool.created_by);
  const itemRow = itemResult.data ? asRecord(itemResult.data) : null;
  const item = itemRow
    ? await signWishlistImage(service, pool.receiver_id, {
        id: String(itemRow.id ?? ""),
        title: String(itemRow.title ?? ""),
        image_url: asString(itemRow.image_url),
        price: itemRow.price == null ? null : asNumber(itemRow.price),
        status: String(itemRow.status ?? "available"),
      })
    : null;
  const contributorCount = asNumber(asRecord(progressResult.data).contributor_count);
  let contributors: PoolPageData["contributors"] = null;

  if (pool.contributors_visible || manager) {
    const { data: contributionRows, error: contributionsError } = await service
      .from("pool_contributions")
      .select("id, amount, contributor_id, paid_at")
      .eq("pool_id", pool.id)
      .eq("status", "paid")
      .eq("applied_to_pool", true)
      .order("paid_at", { ascending: true });

    if (contributionsError) throw contributionsError;
    const rows = (contributionRows ?? []) as UnknownRow[];
    const contributorIds = [...new Set(rows.map((row) => String(row.contributor_id)))];
    const { data: contributorProfiles, error: contributorProfilesError } = contributorIds.length
      ? await service.from("users").select("id, full_name, avatar_url").in("id", contributorIds)
      : { data: [], error: null };

    if (contributorProfilesError) throw contributorProfilesError;
    const contributorById = new Map(
      ((contributorProfiles ?? []) as UnknownRow[]).map((row) => [String(row.id), row])
    );
    const contributorTotals = new Map<string, {
      id: string;
      amount: number;
      paid_at: string | null;
    }>();
    for (const row of rows) {
      const contributorId = String(row.contributor_id);
      const current = contributorTotals.get(contributorId);
      contributorTotals.set(contributorId, {
        id: contributorId,
        amount: (current?.amount ?? 0) + asNumber(row.amount),
        paid_at: asString(row.paid_at) ?? current?.paid_at ?? null,
      });
    }
    contributors = [...contributorTotals.values()].map((total) => {
      const row = asRecord(contributorById.get(total.id));
      return {
        id: total.id,
        amount: total.amount,
        full_name: asString(row.full_name),
        avatar_url: asString(row.avatar_url),
        paid_at: total.paid_at,
      };
    });
  }

  return {
    pool,
    wishlist_title: String(asRecord(wishlistResult.data).title ?? "Wishlist"),
    receiver,
    creator,
    item,
    contributor_count: contributorCount,
    contributors,
    viewer_is_manager: manager,
    viewer_is_receiver: viewerId === pool.receiver_id,
    viewer_is_creator: viewerId === pool.created_by,
  };
}

export async function getDashboardPools(userId: string): Promise<{ active: DashboardPool[]; past: DashboardPool[] }> {
  const service = createServiceClient();
  const { data, error } = await service.from("group_gift_pools").select("*")
    .or(`receiver_id.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const poolRows = (data ?? []) as UnknownRow[];
  const pools = poolRows.map(normalizePool);
  if (pools.length === 0) return { active: [], past: [] };

  const wishlistIds = [...new Set(pools.map((pool) => pool.wishlist_id))];
  const profileIds = [...new Set(pools.flatMap((pool) => [pool.receiver_id, pool.created_by]))];
  const itemIds = [...new Set(pools.map((pool) => pool.wishlist_item_id).filter((id): id is string => Boolean(id)))];
  const poolIds = pools.map((pool) => pool.id);
  const [wishlistsResult, profilesResult, itemsResult, progressResult] = await Promise.all([
    service.from("wishlists").select("id, title").in("id", wishlistIds),
    service.from("users").select("id, full_name").in("id", profileIds),
    itemIds.length ? service.from("wishlist_items").select("id, title, image_url").in("id", itemIds) : Promise.resolve({ data: [], error: null }),
    service.from("group_gift_pool_progress").select("pool_id, contributor_count").in("pool_id", poolIds),
  ]);

  const firstError = wishlistsResult.error || profilesResult.error || itemsResult.error || progressResult.error;
  if (firstError) throw firstError;

  const wishlistById = new Map(((wishlistsResult.data ?? []) as UnknownRow[]).map((row) => [String(row.id), String(row.title ?? "Wishlist")]));
  const profileById = new Map(((profilesResult.data ?? []) as UnknownRow[]).map((row) => [String(row.id), String(row.full_name ?? "Gifvtme member")]));
  const itemRows = (itemsResult.data ?? []) as UnknownRow[];
  const itemById = new Map(itemRows.map((row) => [String(row.id), String(row.title ?? "Gift")]));
  const receiverByItemId = new Map(pools.flatMap((pool) => pool.wishlist_item_id ? [[pool.wishlist_item_id, pool.receiver_id] as const] : []));
  const signedItems = await Promise.all(itemRows.map((row) => {
    const itemId = String(row.id);
    return signWishlistImage(service, receiverByItemId.get(itemId) ?? "", { id: itemId, image_url: asString(row.image_url) });
  }));
  const itemImageById = new Map(signedItems.map((item) => [item.id, item.image_url]));
  const profileById = new Map(((profilesResult.data ?? []) as UnknownRow[]).map((row) => [String(row.id), String(row.full_name ?? "Givftme member")]));
  const itemById = new Map(((itemsResult.data ?? []) as UnknownRow[]).map((row) => [String(row.id), String(row.title ?? "Gift")]));
  const contributorCountByPoolId = new Map(
    ((progressResult.data ?? []) as UnknownRow[]).map((row) => [
      String(row.pool_id), asNumber(row.contributor_count),
    ])
  );

  const dashboardPools: DashboardPool[] = pools.map((pool) => ({
    ...pool,
    wishlist_title: wishlistById.get(pool.wishlist_id) ?? "Wishlist",
    receiver_name: profileById.get(pool.receiver_id) ?? "Givftme member",
    creator_name: profileById.get(pool.created_by) ?? "Givftme member",
    item_title: pool.wishlist_item_id ? itemById.get(pool.wishlist_item_id) ?? null : null,
    item_image_url: pool.wishlist_item_id ? itemImageById.get(pool.wishlist_item_id) ?? null : null,
    contributor_count: contributorCountByPoolId.get(pool.id) ?? 0,
  }));

  return {
    active: dashboardPools.filter((pool) => pool.status === "open" || pool.status === "fully_funded"),
    past: dashboardPools.filter((pool) => ["paid_out", "procured", "cancelled"].includes(pool.status)),
  };
}

export async function attachActivePoolState<T extends Pick<WishlistItem, "id">>(items: T[]): Promise<Array<T & { gifting_type: "individual" | "group"; group_pool_token: string | null }>> {
  if (items.length === 0) return [];
  const itemIds = items.map((item) => item.id);
  const service = createServiceClient();
  const { data, error } = await service.from("group_gift_pools")
    .select("wishlist_item_id, token, created_at")
    .in("wishlist_item_id", itemIds)
    .in("status", ["open", "fully_funded"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load active group gift pool states.", error);
    return items.map((item) => ({ ...item, gifting_type: "individual", group_pool_token: null }));
  }

  const activePoolByItem = new Map<string, string>();
  for (const rowValue of (data ?? []) as UnknownRow[]) {
    const row = asRecord(rowValue);
    const itemId = asString(row.wishlist_item_id);
    const token = asString(row.token);
    if (itemId && token && !activePoolByItem.has(itemId)) activePoolByItem.set(itemId, token);
  }

  return items.map((item) => {
    const token = activePoolByItem.get(item.id) ?? null;
    return { ...item, gifting_type: token ? "group" : "individual", group_pool_token: token };
  });
}
