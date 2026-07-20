# Gifvtme — Architecture

This is the system-level reference. Read `PROJECT_OVERVIEW.md` and `PRD.md` first if you haven't — this file assumes you already know *why* the system is shaped this way and focuses on *how* it fits together.

## System overview

Gifvtme is a Next.js 16 (App Router) application with two backing data stores that each own a distinct part of the domain:

**Supabase (PostgreSQL)** owns everything transactional and user-specific: accounts, wishlists, occasions, purchases, orders, reviews, reminders. Access is governed by Row Level Security policies rather than solely application-level checks.

**Sanity CMS** owns everything editorial and catalog-related: products, collections, occasions-as-museum-content, suppliers. The catalog team manages this directly through Sanity Studio.

Pages that need both (e.g. a product detail page that also needs to know if the current user has wishlisted it) compose data from both sources at the page/server-component level — there is no unified query layer merging them automatically.

Three external services sit alongside these: **Flutterwave** for payment processing, **Microlink** for scraping metadata from external product URLs, and **Resend** for transactional email. **Retool** connects directly to Supabase for internal operations (order review, status updates) — it does not go through the Next.js API layer.

## The two transaction flows

This is the core architectural fork referenced throughout the codebase via `wishlist_items.origin`.

### Flow A — External item (affiliate)

1. User pastes a URL anywhere in the wishlist UI.
2. `/api/scrape` calls Microlink, returns `{ title, image_url, price, currency }`.
3. A `wishlist_items` row is created with `origin = 'external'`, `product_url` set, `affiliate_url` built via the transformer in `lib/affiliate/transform.ts` (network-specific param injection for Jumia/Amazon/Konga, generic UTM fallback otherwise).
4. A giver visiting the shared wishlist clicks "Buy this gift" → redirected to `affiliate_url` → completes purchase on the external site.
5. Giver returns to Gifvtme and confirms completion on the `/w/[id]/confirm/[itemId]` screen.
6. A `purchases` row is inserted (`wishlist_item_id`, `buyer_id`, no payment data). The `on_purchase_created` trigger marks the `wishlist_items` row (and linked `master_items` row if pulled from evergreen) as `purchased`.
7. A thank-you message record is created automatically (`type = 'auto'`).

No money is ever processed by Gifvtme in this flow. No `orders` row is created.

### Flow B — Catalog item (Gifvtme checkout)

1. Item already exists in Sanity (`origin = 'catalog'`, `catalog_product_id` is a Sanity document `_id`).
2. Giver adds one or more catalog items to a cart (client-side state, not persisted until checkout).
3. Checkout collects shipping details, refetches current Sanity prices server-side, creates an `orders` row with `status = 'pending_payment'`, and creates one `order_items` row per product before initiating Flutterwave payment.
4. On payment confirmation (via Flutterwave webhook, `/api/flutterwave/webhook`), the existing order transitions to `confirmed`; `order_items.unit_price` is already snapshotted from the Sanity price at order creation and must never be recalculated afterward.
5. Internal team reviews the confirmed order in Retool, manually changes status (`under_review` → `forwarded` → `shipped` → `delivered`), pasting in tracking info as available.
6. Every status change is automatically logged to `order_status_history` via the `on_order_status_changed` trigger, and (per `ERROR_HANDLING.md`) should trigger a Resend email per stage.
7. If the order originated from a wishlist item, `orders.wishlist_item_id` links back to it, and that item is marked purchased the same way as Flow A once payment confirms.

## Data flow: wishlist sharing

A wishlist's `visibility` field (`private` / `friends_family` / `public`) and `prices_visible` boolean control access, enforced via RLS — see `AUTH_AND_PERMISSIONS.md` for the exact policies. Friends & family access is resolved through `wishlist_invites`, matched against the viewer's `auth.uid()` or email after login, and invite-token URLs are resolved through the narrow `gifvtme_get_shared_wishlist(share_key)` helper for public giver pages. There is no separate sharing/permission table.

## Data flow: reminders

Two independent flows write to the same `reminders` table but with different source references:

- **Flow 1** (receiver reminded about others): sourced from `important_dates`, `reminder_type = 'occasion_owner'`.
- **Flow 2** (friend reminded about receiver's occasion): sourced from `wishlist_invites` where `reminder_opted_in = true`, `reminder_type = 'invitee'`.

Both get two rows per channel (email + push) per reminder window (14 days, 3 days before). A scheduled job (`/api/reminders`, intended to run via cron) queries unsent reminders due now or earlier and processes them.

## Folder structure

See `FOLDER_STRUCTURE.md` for the full annotated tree.

## Third-party integration map

See `THIRD_PARTY_INTEGRATIONS.md` for per-service detail. Summary: Microlink and Flutterwave are called from Next.js API routes. Resend is called from server-side code triggered by database events or API routes. Retool talks to Supabase directly, bypassing the Next.js layer entirely. Sanity is queried via GROQ from server components, using the CDN-backed client for performance.

## Build sequence (4-month solo timeline)

**Month 1 — Foundation.** Supabase schema (both migrations) live, Sanity schema live, auth working, manual-entry-only wishlist creation (no scraping yet).

**Month 2 — Core gifting loop.** Microlink scraping, occasion wishlists pulling from evergreen, shared wishlist view, three-tier sharing, affiliate purchase marking.

**Month 3 — E-commerce & engagement.** Catalog browsing, cart, Flutterwave checkout, order tracking, flash sales, reminders, thank-you messages.

**Month 4 — Reviews, polish, launch.** Reviews system, group gifting data model only (no payment wiring), responsive polish, bug fixing, soft launch.

If you're asked to build something, check `ROADMAP.md` for current status before assuming it doesn't exist yet.

## V2 considerations (do not build now, but the schema should not block these later)

Group gifting payment flows will need a payments-holding mechanism (likely Flutterwave's split/subaccount features) plus refund logic — `group_gift_pools` exists for this. A custom admin dashboard would replace Retool and likely needs its own auth/role model distinct from customer auth. Native apps would most likely share the component logic via React Native Web rather than a full rewrite. Automated supplier API integration would replace the manual Retool review step with webhook-driven order forwarding — the `orders.status` state machine is already designed to accommodate this without restructuring.
