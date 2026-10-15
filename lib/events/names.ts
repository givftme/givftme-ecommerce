// The event catalogue (23-ADMIN-DASHBOARD-SPEC.md, "Event catalogue").
// `user_signed_up` and `order_delivered` are written by database triggers in
// gifvtme_migration_041 so they cover every path that creates the row.
export const EVENT_NAMES = [
  "user_signed_up",
  "date_saved",
  "reminder_sent",
  "reminder_opened",
  "reminder_actioned",
  "date_missed",
  "date_recovered",
  "wishlist_created",
  "wishlist_item_added",
  "wishlist_shared",
  "wishlist_opened",
  "item_claimed",
  "pool_created",
  "pool_contributed",
  "pool_completed",
  "search_performed",
  "order_placed",
  "order_delivered",
  "review_submitted",
  "pool_payout_requested",
  "admin_action",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

// The only events a browser may report through POST /api/events. Everything
// else is recorded server-side where the fact actually happens, so a client
// can't inflate orders, signups, or claims.
export const CLIENT_EVENTS = ["wishlist_shared"] as const satisfies readonly EventName[];
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

export function isClientEvent(value: unknown): value is ClientEventName {
  return typeof value === "string" && (CLIENT_EVENTS as readonly string[]).includes(value);
}

export const ANON_ID_COOKIE = "gv_anon";
export const SESSION_ID_COOKIE = "gv_sid";
