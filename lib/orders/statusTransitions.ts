import type { OrderStatus } from "@/lib/orders/types";

// Mirrors validate_order_status_transition() (gifvtme_migration_019, updated
// by gifvtme_migration_021) exactly — the Postgres trigger is the actual
// enforcement (business rule #11/#12 territory: writes only ever happen
// from Retool via service role), this is a pure JS copy so the transition
// map has unit test coverage per the spec's Testing Requirements, and so
// any future app-side status check doesn't need a database round trip just
// to validate a transition shape.
//
// `cancelled` is reachable from pending_payment/payment_failed as well as
// confirmed/under_review/forwarded/shipped — migration 019 originally
// shipped without those two, leaving an unresolved contradiction against
// 16-ORDER-TRACKING.md's own Functional Requirement #3 ("cancellation is
// allowed from any non-terminal status"). Resolved by explicit developer
// decision 2026-08-12 in favor of the broader FR3 rule (migration 021).
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "payment_failed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
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
