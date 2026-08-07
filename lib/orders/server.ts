import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVE_STATUSES,
  CANCELLED_STATUSES,
  COMPLETED_STATUSES,
  STATUS_GROUPS,
  type OrderCardData,
  type OrderDetail,
  type OrderStatus,
  type OrderStatusGroup,
} from "@/lib/orders/types";

const ALL_TRACKED_STATUSES: OrderStatus[] = [
  ...ACTIVE_STATUSES,
  ...COMPLETED_STATUSES,
  ...CANCELLED_STATUSES,
];

const ORDER_CARD_SELECT =
  "id, status, created_at, total_amount, order_items(product_title, product_image_url)";

interface OrderCardRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  total_amount: number;
  order_items: { product_title: string; product_image_url: string | null }[] | null;
}

// Orders in pending_payment/payment_failed are excluded — they're still
// being resolved on /checkout/processing or /checkout/failed, not part of
// any tracking tab (spec's Active/Completed/Cancelled tabs).
export async function getOrdersForUser(
  supabase: SupabaseClient,
  userId: string,
  group?: OrderStatusGroup,
): Promise<OrderCardData[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_CARD_SELECT)
    .eq("buyer_id", userId)
    .in("status", group ? STATUS_GROUPS[group] : ALL_TRACKED_STATUSES)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as OrderCardRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    total_amount: row.total_amount,
    items: row.order_items || [],
  }));
}

const ORDER_DETAIL_SELECT = `
  id, status, created_at, total_amount,
  shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state,
  tracking_number, tracking_url, carrier_name, estimated_delivery,
  order_items(id, product_title, product_image_url, quantity, unit_price),
  order_status_history(id, status, changed_at, notes)
`;

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
