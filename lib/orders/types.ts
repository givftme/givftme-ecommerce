export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "confirmed"
  | "under_review"
  | "forwarded"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderStatusGroup = "active" | "completed" | "cancelled";

export const ACTIVE_STATUSES: OrderStatus[] = [
  "confirmed",
  "under_review",
  "forwarded",
  "shipped",
];
export const COMPLETED_STATUSES: OrderStatus[] = ["delivered"];
export const CANCELLED_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

// pending_payment/payment_failed orders don't appear in the tracking list —
// they're still being resolved on /checkout/processing or /checkout/failed.
export const STATUS_GROUPS: Record<OrderStatusGroup, OrderStatus[]> = {
  active: ACTIVE_STATUSES,
  completed: COMPLETED_STATUSES,
  cancelled: CANCELLED_STATUSES,
};

export const CUSTOMER_FACING_STATUSES: OrderStatus[] = [
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function statusGroupOf(status: OrderStatus): OrderStatusGroup | null {
  if ((ACTIVE_STATUSES as string[]).includes(status)) return "active";
  if ((COMPLETED_STATUSES as string[]).includes(status)) return "completed";
  if ((CANCELLED_STATUSES as string[]).includes(status)) return "cancelled";
  return null;
}

export interface OrderCardItem {
  product_title: string;
  product_image_url: string | null;
}

export interface OrderCardData {
  id: string;
  status: OrderStatus;
  created_at: string;
  total_amount: number;
  items: OrderCardItem[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: OrderStatus;
  changed_at: string;
  notes: string | null;
}

export interface OrderDetailItem {
  id: string;
  product_title: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
}

export interface OrderDetail {
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
  order_items: OrderDetailItem[];
  order_status_history: OrderStatusHistoryEntry[];
}

// The 4-step tracker's current step for a given order status. Cancelled/
// refunded orders don't map onto the tracker at all — the UI replaces it
// with a banner instead (see OrderTracking.tsx).
export type TrackerStep = "placed" | "processing" | "shipped" | "delivered";

export function trackerStepOf(status: OrderStatus): TrackerStep | null {
  switch (status) {
    case "confirmed":
    case "under_review":
    case "forwarded":
      return "processing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    default:
      return null;
  }
}
