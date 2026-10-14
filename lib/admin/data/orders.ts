import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/admin/audit";
import { adminNextStatuses, type OrderStatusUpdate } from "@/lib/admin/validation";
import type { OrderStatus } from "@/lib/orders/types";

export const ORDER_FILTER_STATUSES = ["all", "pending", "confirmed", "shipped", "delivered", "failed", "cancelled"] as const;
export type OrderFilterStatus = (typeof ORDER_FILTER_STATUSES)[number];

// "Confirmed" covers every paid order still being prepared, so orders under
// review or forwarded to a supplier stay findable.
const FILTER_TO_STATUSES: Record<Exclude<OrderFilterStatus, "all">, OrderStatus[]> = {
  pending: ["pending_payment"],
  confirmed: ["confirmed", "under_review", "forwarded"],
  shipped: ["shipped"],
  delivered: ["delivered"],
  failed: ["payment_failed"],
  cancelled: ["cancelled", "refunded"],
};

export interface OrderFilters {
  status: OrderFilterStatus;
  from: string | null;
  to: string | null;
  city: string | null;
  min: number | null;
  max: number | null;
  late: boolean;
  page: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function numberParam(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOrderFilters(params: Record<string, string | string[] | undefined>): OrderFilters {
  const get = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  };
  const status = get("status");
  const page = Number.parseInt(get("page") || "1", 10);
  return {
    status: (ORDER_FILTER_STATUSES as readonly string[]).includes(status || "") ? (status as OrderFilterStatus) : "all",
    from: DATE.test(get("from") || "") ? get("from")! : null,
    to: DATE.test(get("to") || "") ? get("to")! : null,
    city: get("city")?.slice(0, 80) || null,
    min: numberParam(get("min")),
    max: numberParam(get("max")),
    late: get("late") === "1",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** A Lagos calendar day's start as an ISO instant. */
function lagosDayStart(day: string, addDays = 0) {
  const date = new Date(`${day}T00:00:00+01:00`);
  date.setUTCDate(date.getUTCDate() + addDays);
  return date.toISOString();
}

export interface AdminOrderRow {
  id: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  shipping_city: string | null;
  shipping_state: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  buyer_id: string;
  buyer_name: string | null;
  item_count: number;
  first_item_title: string | null;
}

export const ADMIN_ORDERS_PAGE_SIZE = 25;

interface OrderListRow {
  id: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  shipping_city: string | null;
  shipping_state: string | null;
  estimated_delivery: string | null;
  buyer_id: string;
  order_items: { product_title: string; quantity: number }[] | null;
  order_status_history: { status: string; changed_at: string }[] | null;
}

export async function namesForUsers(service: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, { full_name: string | null; email: string | null }>();
  for (let index = 0; index < unique.length; index += 100) {
    const { data, error } = await service
      .from("users")
      .select("id, full_name, email")
      .in("id", unique.slice(index, index + 100));
    if (error) throw new Error(error.message);
    for (const row of data || []) names.set(row.id, { full_name: row.full_name, email: row.email });
  }
  return names;
}

export async function listAdminOrders(service: SupabaseClient, filters: OrderFilters) {
  let query = service
    .from("orders")
    .select(
      "id, status, total_amount, created_at, shipping_city, shipping_state, estimated_delivery, buyer_id, order_items(product_title, quantity), order_status_history(status, changed_at)",
      { count: "exact" },
    );

  if (filters.status !== "all") query = query.in("status", FILTER_TO_STATUSES[filters.status]);
  if (filters.from) query = query.gte("created_at", lagosDayStart(filters.from));
  if (filters.to) query = query.lt("created_at", lagosDayStart(filters.to, 1));
  if (filters.city) query = query.ilike("shipping_city", `%${filters.city.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (filters.min != null) query = query.gte("total_amount", filters.min);
  if (filters.max != null) query = query.lte("total_amount", filters.max);
  if (filters.late) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
    query = query.lt("estimated_delivery", today);
  }

  const start = (filters.page - 1) * ADMIN_ORDERS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(start, start + ADMIN_ORDERS_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  const rows = (data || []) as unknown as OrderListRow[];
  const buyers = await namesForUsers(service, rows.map((row) => row.buyer_id));
  const orders: AdminOrderRow[] = rows.map((row) => {
    const items = row.order_items || [];
    const delivered = (row.order_status_history || [])
      .filter((entry) => entry.status === "delivered")
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at))[0];
    return {
      id: row.id,
      status: row.status,
      total_amount: Number(row.total_amount),
      created_at: row.created_at,
      shipping_city: row.shipping_city,
      shipping_state: row.shipping_state,
      estimated_delivery: row.estimated_delivery,
      delivered_at: delivered?.changed_at ?? null,
      buyer_id: row.buyer_id,
      buyer_name: buyers.get(row.buyer_id)?.full_name ?? null,
      item_count: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      first_item_title: items[0]?.product_title ?? null,
    };
  });

  const total = count ?? 0;
  return { orders, total, page: filters.page, pageCount: Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE)) };
}

export interface AdminOrderDetail {
  id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string | null;
  created_at: string;
  wishlist_item_id: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_name: string | null;
  estimated_delivery: string | null;
  buyer: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  items: { id: string; product_title: string; product_image_url: string | null; quantity: number; unit_price: number }[];
  history: { id: string; status: string; changed_at: string; notes: string | null; customer_notified: boolean | null }[];
  changes: { action: string; created_at: string; admin_name: string | null; metadata: Record<string, unknown> }[];
  nextStatuses: OrderStatus[];
}

export async function getAdminOrder(service: SupabaseClient, id: string): Promise<AdminOrderDetail | null> {
  const { data, error } = await service
    .from("orders")
    .select(`
      id, status, total_amount, currency, created_at, buyer_id, wishlist_item_id,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state,
      tracking_number, tracking_url, carrier_name, estimated_delivery,
      order_items(id, product_title, product_image_url, quantity, unit_price),
      order_status_history(id, status, changed_at, notes, customer_notified)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [{ data: buyer }, { data: actions }] = await Promise.all([
    service.from("users").select("id, full_name, email, phone").eq("id", data.buyer_id).maybeSingle(),
    service.from("admin_actions").select("action, created_at, admin_id, metadata")
      .eq("target_type", "order").eq("target_id", id).neq("action", "view_order")
      .order("created_at", { ascending: false }).limit(50),
  ]);
  const admins = await namesForUsers(service, (actions || []).map((action) => action.admin_id));

  const { order_items: items, order_status_history: history, buyer_id: _buyerId, ...order } = data as typeof data & {
    order_items: AdminOrderDetail["items"] | null;
    order_status_history: AdminOrderDetail["history"] | null;
  };
  void _buyerId;
  return {
    ...order,
    total_amount: Number(order.total_amount),
    buyer: buyer ?? null,
    items: (items || []).map((item) => ({ ...item, unit_price: Number(item.unit_price) })),
    history: (history || []).slice().sort((a, b) => a.changed_at.localeCompare(b.changed_at)),
    changes: (actions || []).map((action) => ({
      action: action.action,
      created_at: action.created_at,
      admin_name: admins.get(action.admin_id)?.full_name ?? null,
      metadata: (action.metadata || {}) as Record<string, unknown>,
    })),
    nextStatuses: adminNextStatuses(order.status as OrderStatus),
  } as AdminOrderDetail;
}

export type OrderStatusUpdateResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; status: number; error: string };

/**
 * Moves an order to its next status through a plain UPDATE, so the
 * on_order_status_changed trigger logs history (business rule 11) and the
 * transition trigger re-validates it. The `eq("status", current)` guard
 * rejects a change made against a stale view.
 */
export async function updateAdminOrderStatus(
  service: SupabaseClient,
  adminId: string,
  orderId: string,
  input: OrderStatusUpdate,
): Promise<OrderStatusUpdateResult> {
  const { data: order, error } = await service
    .from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return { ok: false, status: 404, error: "Order not found." };

  const current = order.status as OrderStatus;
  if (!adminNextStatuses(current).includes(input.status)) {
    return { ok: false, status: 409, error: `An order that is ${current.replace(/_/g, " ")} can't move to ${input.status.replace(/_/g, " ")}.` };
  }

  const changes: Record<string, unknown> = { status: input.status, status_change_notes: input.notes };
  if (input.tracking_number) changes.tracking_number = input.tracking_number;
  if (input.carrier_name) changes.carrier_name = input.carrier_name;
  if (input.tracking_url) changes.tracking_url = input.tracking_url;

  const { data: updated, error: updateError } = await service
    .from("orders").update(changes).eq("id", orderId).eq("status", current).select("id");
  if (updateError) {
    console.error("Could not update order status.", updateError);
    return { ok: false, status: 500, error: "Couldn't update the order. Try again." };
  }
  if (!updated?.length) {
    return { ok: false, status: 409, error: "This order changed since you opened it. Reload and try again." };
  }

  await logAdminAction(service, adminId, {
    action: "update_order_status",
    targetType: "order",
    targetId: orderId,
    metadata: {
      from: current,
      to: input.status,
      tracking_number: input.tracking_number,
      carrier_name: input.carrier_name,
      notes: input.notes,
    },
  });
  return { ok: true, status: input.status };
}
