# Gifvtme — Business Rules

This file lists hard invariants. Unlike `PRD.md`, which explains reasoning, this file is meant to be checked mechanically: before changing purchase, pricing, auth, or order logic, scan this list and verify nothing here is being broken.

## Purchases & duplication

1. **An item can only be purchased once.** Enforced at the database level via the `one_purchase_per_item` unique constraint on `purchases.wishlist_item_id`. Application code must treat a second purchase attempt on the same item as an error state, not silently allow it, even if the UI hasn't refreshed yet.
2. **A user must have a Gifvtme account before marking any wishlist item as purchased**, regardless of whether the item is external or catalog origin. This is required to support the thank-you message system — there is no anonymous purchase-marking path.
3. **Marking an external item "purchased" never involves Gifvtme processing any payment.** The `purchases` table only records that a redirect happened and the user confirmed completion — it is not a financial transaction record.

## Item origin (external vs catalog)

4. **Every `wishlist_items` row must have `origin` set to either `external` or `catalog`, never null, never anything else.**
5. **If `origin = 'external'`, `product_url` must be present.** If `origin = 'catalog'`, `catalog_product_id` (a Sanity document ID) must be present. These are enforced by database check constraints — do not write code that could violate them.
6. **External items and catalog items must never be combined in a single cart or checkout.** A customer with both types of items in mind completes two separate flows.

## Pricing

7. **The price a customer is charged for a catalog item is permanently snapshotted into `order_items.unit_price` at the time of purchase.** This value must never be recalculated from the current Sanity product price after the fact, even if the Sanity price changes later (sale ends, price increases, etc.). The order record reflects what was actually paid, full stop.
8. **`order_items.total_price` is a generated column (`quantity * unit_price`)** — never write application code that calculates and stores this separately; let the database compute it.
9. **Flash sale prices apply only within the sale's active time window.** Once a flash sale's `endTime` has passed, the regular price applies immediately — there is no grace period and no need for a cron job to "turn off" the sale; the active-sale check is always time-based at read time.

## Orders & fulfillment

10. **Orders for catalog items are never auto-forwarded to suppliers.** A human on the internal team must review and manually change status before any fulfillment action is implied. Do not build or enable any code path that automatically contacts a supplier API in v1.
11. **Every order status change must be logged to `order_status_history`.** This happens automatically via the `on_order_status_changed` trigger — do not bypass this by updating `orders.status` through any path that skips the trigger (e.g. raw SQL that disables triggers).
12. **Customers can only see their own orders and their own order status history.** Enforced via RLS — do not write a query path (e.g. a service-role query exposed to the client) that bypasses this.

## Reviews

13. **A user may only leave a review for a catalog product if they have a completed order containing that product.** This must be checked against the `orders`/`order_items` tables, not merely against whether they're logged in.
14. **A user may leave at most one review per product.**

## Group gifting (v2-reserved, do not activate)

15. **The `group_gift_pools` table and `gifting_type` field exist in the schema but must never be connected to a live payment flow in v1.** If a task description implies building group payment collection, refunds, or contribution tracking with real money, stop and flag it — this is explicitly deferred.

## Reminders

16. **A user must explicitly opt in before being enrolled in Flow 2 reminders (friend reminded about someone else's occasion).** Never auto-enroll an invitee just because they were invited to a wishlist.
17. **Reminder timing is fixed at 14 days and 3 days before the occasion date.** Don't introduce additional reminder intervals without this being a deliberate product decision (see `PRD.md` for context).

## Currency & locale

18. **All prices throughout the application are in Nigerian Naira (₦) with no currency conversion logic.** Do not introduce a currency parameter to formatting functions, price fields, or payment calls — Naira is hardcoded by design for v1.

## Authentication & data access

19. **Wishlist visibility tiers (private / friends & family / public) are enforced via Supabase RLS policies, not solely application-level checks.** Any new query path against `wishlists` or `wishlist_items` must work correctly under RLS — do not introduce service-role bypasses for convenience in customer-facing code.
20. **Friends & family access is resolved through the `wishlist_invites` table**, matching on `invitee_user_id` or `invitee_email` against the authenticated user. There is no separate "shared with me" permission record.

## Scope boundaries (see also PROJECT_OVERVIEW.md)

21. **Do not build a custom admin dashboard.** Retool is the intentional v1 operational interface.
22. **Do not build a wallet or stored balance feature.** No financial holding of customer funds beyond the immediate Flutterwave transaction.
23. **Do not build a social feed.** Out of scope entirely for v1.
24. **Do not build automated supplier API integration.** Order forwarding to suppliers is a manual, human-driven step in v1.
