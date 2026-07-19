# Gifvtme — API Routes

All API routes live under `app/api/` in this repo. This file should be kept current whenever a route is added, removed, or its contract changes — see `PROJECT_OVERVIEW.md` context-file table for the "auto-generatable" note on this file.

## `/api/scrape`
**Method:** POST. **Auth:** required (Supabase session). **Purpose:** calls Microlink to extract product metadata from a pasted URL for the external wishlist item flow.
**Request:** `{ url: string }` (validated via Zod, must be a valid URL).
**Response:** `{ product: { title, image_url, price, currency, product_url } }` on success, `{ error: string }` with 401/400/422 on failure (422 specifically when Microlink fails to scrape — frontend should fall back to manual entry).

## `/api/wishlists`
**Methods:** GET, POST. **Auth:** required. **Purpose:** lists the current user's wishlists and creates/returns the user's evergreen wishlist.
**GET response:** `{ wishlists }`, where each wishlist includes `id`, `title`, `type`, `visibility`, `prices_visible`, and `item_count`.
**POST request:** `{ title?: string, type?: "evergreen" | "occasion" }`. Occasion creation currently returns 400 because occasion wishlists are a later feature; evergreen creation is idempotent.

## `/api/wishlists/[id]`
**Method:** PATCH. **Auth:** required, must own wishlist. **Purpose:** updates wishlist title, visibility, and price visibility.
**Request:** partial `{ title?: string, visibility?: "private" | "friends_family" | "public", prices_visible?: boolean }`. **Response:** `{ wishlist }`.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/[id]/invites`
**Methods:** GET, POST. **Auth:** required, must own wishlist. **Purpose:** lists invites or invites a viewer by email/phone for friends-and-family sharing.
**POST request:** `{ invitee_email?: string, invitee_phone?: string }`, requiring one field. Nigerian phone numbers must match `+234...` or local `0...` format.
**Behavior:** rejects self-invites and duplicates; creates `wishlist_invites` with a DB-generated token; sends a Resend email for email invites when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured. If Resend is not configured, the invite row still succeeds and the server logs a warning.
**Failure shape:** duplicate invites return 409 with `{ error: "You've already invited this person" }`.

## `/api/wishlists/[id]/invites/[inviteId]`
**Method:** DELETE. **Auth:** required, must own wishlist. **Purpose:** revokes an invite. DB cascades remove associated reminder rows where configured.

## `/api/wishlists/[id]/invites/[inviteId]/opt-in`
**Method:** POST. **Auth:** required invitee. **Purpose:** opts an invite-based viewer into Flow 2 reminders and schedules 14-day/3-day invitee reminders when the wishlist has a future occasion date.

## `/api/wishlists/[id]/reminders/opt-in`
**Method:** POST. **Auth:** required. **Purpose:** public-wishlist reminder opt-in. Creates or reuses a `wishlist_invites` row for the authenticated viewer, marks `reminder_opted_in = true`, then schedules invitee reminders.

## `/api/wishlists/[id]/items`
**Methods:** GET, POST. **Auth:** required, must own wishlist. **Purpose:** lists or creates wishlist items.
**GET response:** `{ items }` from `wishlist_items_with_status`, excluding archived items in the page-level helper.
**POST request:** external item only for this feature: `{ origin: "external", title, product_url, image_url?, price?, description?, scraped_currency? }`.
**Behavior:** builds `affiliate_url`, inserts `wishlist_items`, and mirrors evergreen additions into `master_items`. If `sort_order` is missing, add falls back to insert without it and logs that migration 003 must be applied.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/[id]/items/[itemId]`
**Methods:** PATCH, DELETE. **Auth:** required, must own wishlist. **Purpose:** edit an item or soft-delete it.
**PATCH request:** partial `{ title?, image_url?, price?, description? }`. **DELETE behavior:** sets `wishlist_items.status = 'archived'`; never hard-deletes.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/[id]/items/reorder`
**Method:** PATCH. **Auth:** required, must own wishlist. **Purpose:** persists item order.
**Request:** `{ ordered_ids: string[] }`. **Dependency:** requires `gifvtme_migration_003.sql` to be applied so `wishlist_items.sort_order` exists.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/items/[itemId]/flag-intent`
**Methods:** POST, DELETE. **Auth:** required. **Purpose:** giver advisory intent flag.
**POST behavior:** calls the narrow DB helper `gifvtme_flag_wishlist_item_intent`, which only sets `intent_flagged_by` and `intent_flagged_at` when the item is available, readable by the giver, and not already flagged. Already-flagged items return 409.
**DELETE behavior:** clears the flag only when the current user is the flagger.

## `/api/occasions`
**Methods:** GET, POST. **Auth:** required. **Purpose:** lists the current user's occasions and creates occasion wishlists.
**POST request:** `{ title, occasion_type, occasion_date, pulled_item_ids?, exclusive_items? }`. Creation writes the occasion, linked wishlist, pulled wishlist items, and exclusive wishlist items through a single database transaction before non-blocking reminder scheduling.

## `/api/occasions/[id]`
**Methods:** GET, PATCH, DELETE. **Auth:** required, must own occasion. **Purpose:** loads, edits, or archives an occasion.
**PATCH request:** partial `{ title?, occasion_type?, occasion_date? }`. Title edits update the linked occasion wishlist title in the same database transaction as the occasion row.
**DELETE behavior:** soft-archives the occasion and deletes that occasion's unsent owner reminders.

## `/api/reminders`
**Method:** POST. **Auth:** protected by `Authorization: Bearer ${CRON_SECRET}` header, not user auth — intended to be called by a scheduled job (Vercel Cron or external scheduler), not the frontend.
**Purpose:** expires wishlist item intent flags older than 24 hours, then queries `reminders` where `sent = false` and `scheduled_at <= now()`.
**Response:** `{ processed: number, deferred: number }`.
**Status as of this writing:** reminder email/push delivery is intentionally deferred to the Reminders feature. Due reminder rows remain `sent = false` as the handoff queue until a real dispatcher succeeds and marks them sent. Do not assume reminder emails are firing until this is completed; check `ROADMAP.md`.

## `/api/checkout` (to be built)
**Method:** POST. **Auth:** required. **Purpose:** initiates a Flutterwave payment for catalog items in the cart.
**Expected request shape:** cart items (catalog product IDs + quantities + selected variant `combinationKey` where applicable) + shipping details.
**Expected response:** a Flutterwave checkout URL or inline payment token to redirect/initialize the client SDK with.
**Note:** this route should create the `orders` row with `status = 'pending_payment'` before redirecting to Flutterwave, not after — so an abandoned payment still leaves a traceable record.

## `/api/flutterwave/webhook` (to be built)
**Method:** POST. **Auth:** none via user session — verified via Flutterwave's webhook signature header instead. **Purpose:** receives payment confirmation/failure events from Flutterwave, updates the corresponding `orders.status` to `confirmed` or `payment_failed`, and creates `order_items` rows with price snapshots.
**Critical:** must verify the webhook signature before trusting the payload — never update order status based on an unverified webhook call. See `THIRD_PARTY_INTEGRATIONS.md` for the verification mechanism.

## `/api/orders/[id]/status` (to be built)
**Method:** PATCH. **Auth:** intended for Retool (service role), not customer-facing. **Purpose:** updates an order's status; relies on the `on_order_status_changed` trigger to log to `order_status_history` automatically. Consider whether this needs to exist as a Next.js route at all, since Retool can write to Supabase directly — only build this if Retool's direct-write approach proves insufficient (e.g. if you need to trigger a Resend email synchronously on status change).

## `/api/purchases`
**Method:** POST. **Auth:** required. **Purpose:** the external-flow "mark as purchased" action — creates a `purchases` row after a giver confirms they completed an affiliate purchase.
**Request:** `{ wishlist_item_id: string }`.
**Behavior:** verifies the item exists, is still available, and has `origin = "external"`; inserts `{ wishlist_item_id, buyer_id }`. The `on_purchase_created` DB trigger handles marking the item/master item purchased and creating the automated thank-you record. Unique-constraint races return 409 with a user-friendly message.

## `/api/reviews` (to be built)
**Method:** POST. **Auth:** required. **Purpose:** create a review. Must verify the user has a completed order containing the referenced `catalog_product_id` before allowing the insert (business rule #13) — this check should happen in the route handler, not rely solely on RLS, since the verified-purchase logic is more complex than a simple ownership check.

## `/api/webhooks` (folder exists, currently empty)
Reserved for future webhook handlers beyond Flutterwave (e.g. if Resend or a dropshipping supplier API needs a webhook later). Currently unused — do not assume anything here is implemented.

## Auth callback (not under `/api` but functionally similar)
`app/(auth)/callback/route.ts` — handles Supabase's email confirmation and OAuth redirect, exchanges the code for a session, preserves a safe `redirect` param when present, redirects to `/wishlists` by default on success, or `/login?error=confirmation_failed` on failure.

## General conventions for new routes

Validate request bodies with Zod, matching the pattern in `/api/scrape`. Return `{ error: string }` with an appropriate status code on failure — never a bare 500 with no body. Server-side routes that need elevated database access should use `createServiceClient()` from `lib/supabase/server.ts`, but only when the operation genuinely needs to bypass RLS (e.g. system-triggered actions) — prefer the regular server client (`createClient()`) for anything acting on behalf of an authenticated user, so RLS stays the enforced boundary.
