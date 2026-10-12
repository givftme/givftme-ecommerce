import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STATUS_GROUPS,
  type OrderCardData,
  type OrderDetail,
  type OrderStatus,
  type OrderStatusGroup,
} from "@/lib/orders/types";

const ORDER_CARD_SELECT =
  "id, status, created_at, total_amount, estimated_delivery, order_items(product_title, product_image_url, catalog_product_id, quantity)";

interface OrderCardRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  total_amount: number;
  estimated_delivery: string | null;
  order_items: { product_title: string; product_image_url: string | null; catalog_product_id: string; quantity: number }[] | null;
}

export const ACCOUNT_ORDERS_PAGE_SIZE = 10;
const PENDING_PAYMENT_EXPIRY_DAYS = 7;

export interface OrderPage {
  orders: OrderCardData[];
  count: number;
  page: number;
  has_more: boolean;
}

function getPendingPaymentThreshold(now: Date) {
  return new Date(now.getTime() - PENDING_PAYMENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function getQueryStatuses(group: OrderStatusGroup): OrderStatus[] {
  return group === "cancelled"
    ? [...STATUS_GROUPS.cancelled, "pending_payment"]
    : STATUS_GROUPS[group];
}

export async function getOrderPageForUser(
  supabase: SupabaseClient,
  userId: string,
  group: OrderStatusGroup,
  page = 1,
  now = new Date(),
): Promise<OrderPage> {
  const threshold = getPendingPaymentThreshold(now);
  let query = supabase.from("orders")
    .select(ORDER_CARD_SELECT, { count: "exact" })
    .eq("buyer_id", userId)
    .in("status", getQueryStatuses(group));

  if (group === "active") {
    query = query.or(`status.neq.pending_payment,created_at.gte.${threshold}`);
  } else if (group === "cancelled") {
    query = query.or(`status.neq.pending_payment,created_at.lt.${threshold}`);
  }

  const start = (page - 1) * ACCOUNT_ORDERS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(start, start + ACCOUNT_ORDERS_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  const rows = (data || []) as unknown as OrderCardRow[];
  const reviewableProductIds = Array.from(new Set(
    rows
      .filter((row) => row.status === "delivered")
      .flatMap((row) => (row.order_items || []).map((item) => item.catalog_product_id))
      .filter(Boolean),
  ));
  const reviewedProductIds = new Set<string>();
  if (reviewableProductIds.length > 0) {
    const productChunks: string[][] = [];
    for (let index = 0; index < reviewableProductIds.length; index += 100) {
      productChunks.push(reviewableProductIds.slice(index, index + 100));
    }
    const reviewResults = await Promise.all(productChunks.map((productIds) =>
      supabase.from("reviews")
        .select("catalog_product_id")
        .eq("user_id", userId)
        .in("catalog_product_id", productIds),
    ));
    for (const result of reviewResults) {
      if (result.error) throw new Error(result.error.message);
      for (const review of result.data || []) reviewedProductIds.add(review.catalog_product_id);
    }
  }

  const orders = rows.map((row) => {
    const expired = row.status === "pending_payment" && row.created_at < threshold;
    const items = row.order_items || [];
    const unreviewedProductId = row.status === "delivered"
      ? items.find((item) => !reviewedProductIds.has(item.catalog_product_id))?.catalog_product_id || null
      : null;
    return {
      id: row.id,
      status: row.status,
      display_status: expired ? "payment_expired" as const : row.status,
      created_at: row.created_at,
      total_amount: row.total_amount,
      estimated_delivery: row.estimated_delivery,
      unreviewed_product_id: unreviewedProductId,
      items,
    };
  });
  const totalCount = count ?? 0;
  return {
    orders,
    count: totalCount,
    page,
    has_more: start + orders.length < totalCount,
  };
}

export async function getOrderCountsForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<Record<OrderStatusGroup, number>> {
  const threshold = getPendingPaymentThreshold(now);
  const countGroup = async (group: OrderStatusGroup) => {
    let query = supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .in("status", getQueryStatuses(group));
    if (group === "active") query = query.or(`status.neq.pending_payment,created_at.gte.${threshold}`);
    if (group === "cancelled") query = query.or(`status.neq.pending_payment,created_at.lt.${threshold}`);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const [active, completed, cancelled] = await Promise.all([
    countGroup("active"),
    countGroup("completed"),
    countGroup("cancelled"),
  ]);
  return { active, completed, cancelled };
}

const ORDER_DETAIL_SELECT = `
  id, status, created_at, total_amount,
  shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state,
  tracking_number, tracking_url, carrier_name, estimated_delivery,
  order_items(id, product_title, product_image_url, quantity, unit_price),
  order_status_history(id, status, changed_at, notes)
`;
// Plain `status` again as of migration 024 — order_status_history's legacy
// old_status/new_status columns (which this briefly routed through instead,
// see ROADMAP.md) were dropped rather than root-caused, removing the
// ambiguity rather than working around it.

interface OrderDetailRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  total_amount: number;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_name: string | null;
  estimated_delivery: string | null;
  order_items: OrderDetail["order_items"] | null;
  order_status_history: OrderDetail["order_status_history"] | null;
}

export async function getOrderDetail(
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_SELECT)
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as OrderDetailRow;

  return {
    ...row,
    order_items: row.order_items || [],
    order_status_history: (row.order_status_history || [])
      .slice()
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at)),
  };
}
