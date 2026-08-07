import type { OrderStatus } from "@/lib/orders/types";

// Mirrors validate_order_status_transition() (gifvtme_migration_019) exactly
// — the Postgres trigger is the actual enforcement (business rule #11/#12
// territory: writes only ever happen from Retool via service role), this is
// a pure JS copy so the transition map has unit test coverage per the
// spec's Testing Requirements, and so any future app-side status check
// doesn't need a database round trip just to validate a transition shape.
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "payment_failed"],
  payment_failed: ["pending_payment"],
  confirmed: ["under_review", "cancelled"],
  under_review: ["forwarded", "cancelled"],
  forwarded: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function isValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!isValidOrderStatusTransition(from, to)) {
    throw new Error(`Invalid status transition from ${from} to ${to}`);
  }
}
