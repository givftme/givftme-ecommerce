import type { SupabaseClient } from "@supabase/supabase-js";
import { ratio } from "@/lib/admin/format";
import { maskToInitials } from "@/lib/admin/privacy";

async function rpcJson<T>(service: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await service.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const num = (value: unknown) => Number(value ?? 0);

// --- Calendar Engine ---------------------------------------------------

export interface CalendarData {
  dates_by_month: { month: string; occasion_type: string; count: number }[];
  occasion_mix: { occasion_type: string; count: number }[];
  reminders: { channel: string; days_before: number | null; sent: number; opened: number; actioned: number }[];
  lead_time: { bucket: string; orders: number }[];
  missed_by_month: { month: string; missed: number; recovered: number }[];
  streaks: { user_id: string; name: string | null; months: number }[];
}

export function getCalendar(service: SupabaseClient) {
  return rpcJson<CalendarData>(service, "gifvtme_admin_calendar");
}

// --- Wishlists & Sharing ----------------------------------------------

interface WishlistMetricsRow {
  lists_created: number;
  avg_items_per_list: number;
  items_total: number;
  items_no_price: number;
  source: { catalog: number; external_scraped: number; external_manual: number; external_untracked: number };
  lists_shared: number;
  shares: number;
  opens: number;
  claims: number;
  attributed_signups: number;
}

export interface WishlistMetrics extends WishlistMetricsRow {
  shareRate: number | null;
  opensPerShare: number | null;
  claimsPerOpen: number | null;
  kFactor: number | null;
}

/** Rates from raw counts; the per-share and per-open values are plain ratios. */
export function deriveWishlistMetrics(row: WishlistMetricsRow): WishlistMetrics {
  return {
    ...row,
    shareRate: ratio(row.lists_shared, row.lists_created),
    opensPerShare: row.shares > 0 ? row.opens / row.shares : null,
    claimsPerOpen: row.opens > 0 ? row.claims / row.opens : null,
    kFactor: row.lists_shared > 0 ? row.attributed_signups / row.lists_shared : null,
  };
}

export async function getWishlistMetrics(service: SupabaseClient, since: string | null) {
  const row = await rpcJson<WishlistMetricsRow>(service, "gifvtme_admin_wishlist_metrics", { p_since: since });
  return deriveWishlistMetrics({
    ...row,
    lists_created: num(row.lists_created),
    avg_items_per_list: num(row.avg_items_per_list),
    items_total: num(row.items_total),
    items_no_price: num(row.items_no_price),
    lists_shared: num(row.lists_shared),
    shares: num(row.shares),
    opens: num(row.opens),
    claims: num(row.claims),
    attributed_signups: num(row.attributed_signups),
  });
}

export interface TopSharedWishlist {
  wishlist_id: string;
  receiver: string;
  occasion: string | null;
  occasion_type: string | null;
  shares: number;
  claims: number;
  attributed_signups: number;
}

export async function getTopSharedWishlists(service: SupabaseClient, since: string | null): Promise<TopSharedWishlist[]> {
  const rows = await rpcJson<{ wishlist_id: string; owner_name: string | null; occasion_title: string | null; occasion_type: string | null; shares: number; claims: number; attributed_signups: number }[]>(
    service, "gifvtme_admin_top_shared_wishlists", { p_since: since, p_limit: 10 });
  return (rows || []).map((row) => ({
    wishlist_id: row.wishlist_id,
    // Receivers are ranked here, so only their initials are shown.
    receiver: maskToInitials(row.owner_name),
    occasion: row.occasion_title,
    occasion_type: row.occasion_type,
    shares: num(row.shares),
    claims: num(row.claims),
    attributed_signups: num(row.attributed_signups),
  }));
}

// --- Demand Intelligence ----------------------------------------------

export interface DemandData {
  top_items: { title: string; wishes: number; avg_price: number | null; top_occasion: string | null; top_city: string | null }[];
  searches: { query: string; searches: number; with_results: number; zero_results: number }[];
  zero_results: { query: string; searches: number }[];
  domains: { domain: string; items: number }[];
  gap: { category: string; wanted: number; bought: number }[];
}

export function getDemand(service: SupabaseClient, since: string | null, occasion: string | null) {
  return rpcJson<DemandData>(service, "gifvtme_admin_demand", { p_since: since, p_occasion: occasion });
}

// --- Diaspora ----------------------------------------------------------

export interface DiasporaData {
  totals: { orders: number; value: number; givers: number };
  countries: { country: string; orders: number; value: number; givers: number }[];
  receivers: { area: string; orders: number; value: number }[];
  occasions: { occasion_type: string; orders: number }[];
}

export function getDiaspora(service: SupabaseClient, since: string | null) {
  return rpcJson<DiasporaData>(service, "gifvtme_admin_diaspora", { p_since: since });
}

// --- Money -------------------------------------------------------------

export interface MoneyData {
  catalog: { orders: number; gross: number };
  pool_funds: number;
  refunded_total: number;
  aov_trend: { day: string; aov: number | null }[];
  refunds: { order_id: string; amount: number; refunded_at: string; reason: string | null; approved_by: string | null }[];
  planners_rate: { bucket: string; orders: number }[];
}

export async function getMoney(service: SupabaseClient, since: string | null): Promise<MoneyData> {
  const [money, histogram] = await Promise.all([
    rpcJson<Omit<MoneyData, "planners_rate">>(service, "gifvtme_admin_money", { p_since: since }),
    rpcJson<{ bucket: string; orders: number }[]>(service, "gifvtme_admin_lead_time_histogram", { p_since: since }),
  ]);
  return {
    ...money,
    planners_rate: (histogram || []).map((row) => ({ bucket: row.bucket, orders: num(row.orders) })),
  };
}
