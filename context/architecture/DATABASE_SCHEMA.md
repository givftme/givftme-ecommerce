# Gifvtme — Database Schema

This is a readable companion to the two SQL migration files (`gifvtme_migration.sql`, `gifvtme_migration_002.sql`) and the Sanity schema (`sanity/schemaTypes/`). When the migrations change, this file should be updated to match — see "Keeping this file in sync" at the bottom.

## The most important field in the entire schema

`wishlist_items.origin` (`external` | `catalog`) and the identically-shaped `master_items.origin`. This single field determines which transaction flow an item follows — see `architecture/ARCHITECTURE.md` for the full flow breakdown. Every feature touching purchases, pricing, or checkout needs to branch on this field.

## Supabase tables

### `users`
Extends `auth.users` with profile data. `default_thank_you_msg` lives here so it's reusable across every purchase without duplication. Auto-created via the `handle_new_user` trigger on signup.

### `master_items`
The evergreen wishlist pool. `origin` + `catalog_product_id` mirror `wishlist_items`. `status` (`active`/`purchased`/`archived`) tracks whether an evergreen item is currently "claimed" — this is what the occasion-archive reactivation flow (see `PRD.md`) reads and writes. Migration 003 adds `sort_order` for evergreen ordering.

### `occasions`
Birthday, wedding, anniversary, etc. `status` (`active`/`archived`) plus `archived_at` drives the reactivation notification flow.

### `wishlists`
`type` (`evergreen`/`occasion`), `occasion_id` (nullable — only set for occasion-type lists), `visibility` (`private`/`friends_family`/`public`), `prices_visible` (the single global price toggle — there is no item-level visibility). A user has at most one evergreen wishlist, enforced by a partial unique constraint.

### `wishlist_items`
The core item table. Key fields: `origin`, `catalog_product_id` (Sanity `_id`, only for catalog origin), `product_url`/`affiliate_url` (only for external origin), `master_item_id` (nullable link back to `master_items` when an occasion pulls from evergreen; added by migration 005), `gifting_type` (`individual`/`group` — reserved for v2, never wired to payment in v1), `status` (`available`/`purchased`/`archived`), `is_exclusive` (true if this item belongs only to an occasion, not pulled from evergreen), and `sort_order` (added by migration 003 for manual ordering). Migration 005 enforces one pulled item row per `(wishlist_id, master_item_id)` when `master_item_id` is set. Migration 006 adds `intent_flagged_by` and `intent_flagged_at` for the 24-hour advisory "someone is buying this" flag.

### `purchases`
Records affiliate-flow purchases only. `wishlist_item_id` has a unique constraint (`one_purchase_per_item`) — this is the database-level enforcement of business rule #1. No payment data lives here; it's purely a "this was claimed" record. Migration 004 now backfills `created_at` if the original remote table is missing it, because `wishlist_items_with_status` exposes that timestamp as `affiliate_purchased_at`. The `on_purchase_created` trigger marks the item (and linked master item) as purchased automatically.

### `orders`
Catalog-flow purchases only. Tracks the full lifecycle via `status`: `pending_payment` → `confirmed`/`payment_failed` → `under_review` → `forwarded` → `shipped` → `delivered` (or `cancelled`/`refunded` at various points). Carries Flutterwave transaction references, shipping details, and tracking info. `wishlist_item_id` is nullable — set when the order originated from a wishlist purchase, null for direct shop purchases.

### `order_items`
One row per product per order. `unit_price` and `product_title`/`product_image_url` are **snapshots at time of purchase** — never recalculated from current Sanity data (business rule #7). `total_price` is a generated column (`quantity * unit_price`).

### `order_status_history`
Append-only log, auto-populated by the `on_order_status_changed` trigger whenever `orders.status` changes. Never insert into this table directly from application code — let the trigger do it.

### `thank_you_messages`
References either `purchase_id` (external flow) or `order_id` (catalog flow) — exactly one must be set, enforced by a check constraint. `type` is `auto` or `personal`.

### `wishlist_invites`
Tracks who's been invited to view a wishlist. `token` is the invite-specific sharing token (used in `/w/[token]` URLs). `invitee_email`, `invitee_phone`, and `invitee_user_id` identify the invitee; `reminder_opted_in` is the explicit opt-in flag for Flow 2 reminders — never default this to true. Migration 006 adds/repairs invite metadata columns and unique indexes for token, per-wishlist email, per-wishlist phone, and per-wishlist invitee user.

### `important_dates`
The receiver's personal calendar of *other* people's occasions (Flow 1 reminders). `linked_wishlist_id` is optional — set if that person also has a Gifvtme wishlist.

### `reminders`
Generic reminder queue. `reminder_type` (`occasion_owner`/`invitee`) plus exactly one of `important_date_id`, `invite_id`, or `occasion_id` set, enforced by a check constraint. `occasion_id` links owner reminders created for a user-created occasion so rescheduling or archiving one occasion only deletes that occasion's unsent reminders. `channel` (`email`/`push`), `scheduled_at`, `sent` flag.

### `group_gift_pools`
Reserved for v2. `wishlist_item_id` unique constraint (one pool per item). No RLS policies are defined yet — intentionally, since this table must not be queryable or writable from customer-facing code in v1 (business rule #15).

### `reviews` (to be added — not yet in the migrations as of this writing)
Will need: `id`, `user_id`, `catalog_product_id` (Sanity reference), `order_item_id` (to enforce verified-purchase gating per business rule #13), `rating` (1–5), `body`, `created_at`. Unique constraint on `(user_id, catalog_product_id)` to enforce business rule #14 (one review per product per user).

### View: `wishlist_items_with_status`
Joins `wishlist_items` against both `purchases` (external flow) and `orders` (catalog flow, excluding `pending_payment`/`payment_failed`/`cancelled` statuses) so the frontend can determine purchased state regardless of which flow an item went through, without needing to know which table to check. Migration 004 recreates this view with the dashboard item fields the app selects, including `description` and `sort_order`; migration 005 adds `master_item_id` to the view for occasion wishlist sections; migration 006 adds `intent_flagged_by` and `intent_flagged_at`. The anon-readable view exposes purchase status metadata, but not raw buyer, purchase, or order identifiers. The view filters rows through `gifvtme_can_read_wishlist_by_id(wishlist_id)` so wishlist visibility rules still apply to direct view reads.

### Sharing helper functions
Migration 006 adds narrow security-definer functions used through the regular Supabase client:

- `gifvtme_get_shared_wishlist(share_key)` resolves `/w/[id]` as an invite token or public wishlist ID and returns only the shared wishlist payload allowed by that key.
- `gifvtme_accept_wishlist_invite(invite_id)` claims an invite for the authenticated viewer after login.
- `gifvtme_flag_wishlist_item_intent(item_id)` and `gifvtme_clear_wishlist_item_intent(item_id)` only mutate the two intent flag columns.
- `gifvtme_opt_in_wishlist_invite(invite_id)` marks explicit Flow 2 reminder opt-in without granting broad invite-row update rights.

## Supabase Storage

### Bucket: `wishlist-images`
Used by manual wishlist item image upload. Must be created in Supabase Storage as a private bucket, with a 5MB file size limit and allowed MIME types `image/jpeg`, `image/png`, and `image/webp`. The app stores object paths on wishlist rows and creates short-lived signed URLs only after the viewer is authorized to read the wishlist.

## Sanity documents

### `supplier`
Dropshipping supplier reference (Spocket, CJDropshipping, etc). Referenced by `product.supplier`.

### `occasion`
Museum-facing occasion content — distinct from the Supabase `occasions` table (that one is user-created instances; this one is editorial museum content like cover images and descriptions). `occasionType` should be kept in sync with the values used in Supabase's `occasions.occasion_type` enum.

### `collection`
Editorial groupings within an occasion. References one `occasion`. Products reference collections (many-to-many — a product can appear in several collections).

### `product`
The core catalog document. `hasVariants` toggles between simple pricing (`basePrice`, `baseSku`) and complex variants (`attributes` + `variants` array, each variant having its own `combinationKey`, `price`, `supplierSku`). Flash sale fields (sale price, start/end time) should be added here — see `BUSINESS_RULES.md` rule #9 for the time-window semantics. `supplierProductId` is what gets used when the internal team manually forwards an order.

### Object types
`attributeOption` (a single value like "Medium" or "Red"), `variantAttribute` (a dimension like "Size" with a list of options), `productVariant` (one purchasable combination with its own price/SKU/`combinationKey`).

## Keeping this file in sync

Whenever a migration file changes: update the relevant table section above. Whenever a Sanity schema file changes: update the relevant document section above. This file is intentionally allowed to lag slightly behind the SQL/schema files (which are the source of truth) but should never be more than one migration behind.
