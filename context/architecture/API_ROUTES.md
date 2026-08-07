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
**POST request:** either external `{ origin: "external", title, product_url, image_url?, price?, description?, scraped_currency? }` or catalog `{ origin: "catalog", catalog_product_id, title, image_url?, price, description?, is_exclusive? }`.
**Behavior:** external items build `affiliate_url`; catalog items set `catalog_product_id` and leave `product_url`/`affiliate_url` null. For catalog adds, `title`/`image_url`/`price` in the request are accepted for schema compatibility but ignored — the route re-fetches the product from Sanity via `CART_PRICES_QUERY` by `catalog_product_id` and uses that (title, image, and a price from `getFromPrice()`) as the source of truth, rejecting with 400 if the product is missing or not `status: "active"`. `getFromPrice()` calls `getActivePrice()` directly for non-variant products; for variant products it uses the product-level sale price when an active flash sale window applies, otherwise the cheapest available variant price — never a flat `getActivePrice()` call, which would silently save `price: 0` for a variant product with no base price. Before inserting, catalog adds check for an existing non-archived `wishlist_items` row with the same `wishlist_id` + `catalog_product_id` and return 409 `{ error: "Already on this wishlist." }` rather than creating a duplicate. This is backed by a DB-level partial unique index (`wishlist_items_live_catalog_unique`, `gifvtme_migration_011_catalog_wishlist_dedupe.sql`, excludes archived rows) so it's race-safe under concurrent requests, not just an app-level check — a 23505 on insert also maps to the same 409. Both insert `wishlist_items` and mirror evergreen additions into `master_items` — occasion-wishlist adds do not touch `master_items`, since it's the evergreen pool. If `sort_order` is missing, add falls back to insert without it and logs that migration 003 must be applied.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/catalog-items`
**Method:** GET. **Auth:** optional — catalog browsing is public. **Purpose:** returns the current user's wishlisted catalog product IDs so product cards can render a filled heart. Unauthenticated requests get `{ catalogProductIds: [] }` with 200 rather than 401, since this backs a passive display check, not a gated action.
**Response:** `{ catalogProductIds: string[] }`, deduped `catalog_product_id` values across all of the user's wishlists.

## `/api/analytics`
**Method:** POST. **Auth:** none. **Purpose:** server-side landing point for client-side `trackEvent()` calls (`lib/analytics.ts`) in production, so they reach the same log output as server-side calls instead of only the visitor's own browser console. No real analytics vendor is wired up yet — this just logs the event server-side via `console.log`.
**Request:** `{ event: string, properties?: Record<string, boolean | number | string | null> }`. **Response:** always `204`, even on a malformed body — analytics must never surface an error to the UI.

## `/api/newsletter`
**Method:** POST. **Auth:** none. **Purpose:** stores catalog/homepage newsletter subscription emails in `newsletter_subscribers`.
**Request:** `{ email: string }`, validated by Zod email format.
**Response:** `{ ok: true }` with 201 on success. Duplicate emails return 409 with `{ error: "You're already subscribed." }`.

## `/api/collections/[slug]/products`
**Method:** GET. **Auth:** none. **Purpose:** fetches the next paginated batch of active Sanity products for a collection page.
**Query params:** `offset` (default 0), `limit` (default 12, max 48).
**Response:** `{ products, totalProducts }`, where `products` are normalized catalog product card rows.

## `/api/shop/products`
**Method:** GET. **Auth:** none. **Purpose:** fetches the next paginated batch of active Sanity products for the flat shop page.
**Query params:** `offset` (default 0), `limit` (default 16, max 48).
**Response:** `{ products, totalProducts }`, where `products` are normalized catalog product card rows.

## `/api/wishlists/[id]/items/[itemId]`
**Methods:** PATCH, DELETE. **Auth:** required, must own wishlist. **Purpose:** edit an item or soft-delete it.
**PATCH request:** partial `{ title?, image_url?, price?, description? }`. For evergreen wishlists, also best-effort syncs the same `title`/`image_url`/`price` fields to the matching `master_items` row — matched by `user_id` + `origin` + `catalog_product_id`/`product_url` (closest `created_at` breaks ties), since evergreen `wishlist_items` have no FK back to their own `master_items` row (`master_item_id` is reserved for occasion-pull links, see migration 005). `description` is not mirrored — `master_items` has no such column.
**DELETE behavior:** sets `wishlist_items.status = 'archived'`; never hard-deletes.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/[id]/items/reorder`
**Method:** PATCH. **Auth:** required, must own wishlist. **Purpose:** persists item order.
**Request:** `{ ordered_ids: string[] }`. **Dependency:** requires `gifvtme_migration_003.sql` to be applied so `wishlist_items.sort_order` exists.
**Failure shape:** unauthenticated requests return `{ error }` with 401; missing or non-owned wishlist IDs return `{ error: "Wishlist not found." }` with 404, never 403.

## `/api/wishlists/items/[itemId]/flag-intent`
**Methods:** POST, DELETE. **Auth:** required. **Purpose:** giver advisory intent flag.
**POST behavior:** calls the DB helper `gifvtme_flag_wishlist_item_intent` (migration 014), which sets `intent_flagged_by`/`intent_flagged_at` when the item is available, readable by the giver, and either unflagged, flagged by the caller, or flagged by someone else more than 24h ago (expiring last-write-wins). Returns `{ flagged: true }` on success. If another user has an active flag younger than 24h, returns 200 `{ warning: "already_flagged", flagged_at }` instead of overwriting — the frontend shows the "someone else is planning to buy this" state with a "Buy anyway" reveal. Purchased items return 409 `{ error }`; missing/inaccessible items return 404.
**DELETE behavior:** clears the flag only when the current user is the flagger (silent no-op otherwise — `{ cleared: true }` either way, per the spec's own "just refresh" guidance for that case).

## `/api/occasions`
**Methods:** GET, POST. **Auth:** required. **Purpose:** lists the current user's occasions and creates occasion wishlists.
**POST request:** `{ title, occasion_type, occasion_date, pulled_item_ids?, exclusive_items? }`. Creation writes the occasion, linked wishlist, pulled wishlist items, and exclusive wishlist items through a single database transaction before non-blocking reminder scheduling.

## `/api/occasions/[id]`
**Methods:** GET, PATCH, DELETE. **Auth:** required, must own occasion. **Purpose:** loads, edits, or archives an occasion.
**PATCH request:** partial `{ title?, occasion_type?, occasion_date? }`. Title edits update the linked occasion wishlist title in the same database transaction as the occasion row. A changed `occasion_date` reschedules both the owner's reminders (`rescheduleOccasionReminders`) and, separately, every opted-in invite's Flow 2 reminders (`rescheduleInviteeRemindersForOccasion` — keyed off each invitee's own user id, since invitee reminder rows belong to the giver, not the receiver).
**DELETE behavior:** soft-archives the occasion, deletes that occasion's unsent owner reminders, and (best-effort) inserts an `occasion_prompts` row if the occasion has purchased evergreen (non-exclusive) items — see `/api/occasions/[id]/reactivate` and `DATABASE_SCHEMA.md`.

## `/api/occasions/[id]/items`
**Method:** POST. **Auth:** required, must own occasion; occasion must not be archived. **Purpose:** pulls additional evergreen items onto an already-created occasion (the "Add from wishlist" action on the occasion detail page).
**Request:** `{ pulled_item_ids: string[] }`. **Response:** `{ items }`. Items already pulled onto this occasion, or master items that are purchased/archived, are silently skipped rather than erroring.

## `/api/occasions/[id]/reactivate`
**Method:** POST. **Auth:** required, must own occasion; occasion must be archived. **Purpose:** resolves the reactivation prompt shown on an archived occasion (and the dashboard-wide `ReactivationPromptsBanner`) — restores selected purchased evergreen items to `available`.
**Request:** `{ item_ids: string[] }` (master_item_ids to restore; an empty array means "keep everything as purchased").
**Behavior:** flips `master_items.status` back to `available` for the selected, still-purchased, non-exclusive items pulled onto this occasion. Marks any open `occasion_prompts` row for this occasion as resolved regardless of selection, since arriving here means the user made a decision either way.

## `/api/occasions/archive` (cron route)
**Method:** POST. **Auth:** protected by `Authorization: Bearer ${CRON_SECRET}` header, not user auth — intended to run daily via a scheduled job.
**Purpose:** archives occasions whose `occasion_date` is more than 7 days past, using the service-role client. For each newly archived occasion, best-effort inserts an `occasion_prompts` row if it has purchased evergreen items. Also auto-resolves any `occasion_prompts` row older than 30 days that's still unresolved (items are left as purchased — this only stops the dashboard nudge).
**Response:** `{ archived: number }`.

## `/api/important-dates`
**Methods:** GET, POST. **Auth:** required. **Purpose:** Flow 1 — lists or creates the current user's saved "important dates" (someone else's birthday/anniversary/etc, not tied to a wishlist the user created).
**GET response:** `{ dates }`, ordered by `date` ascending.
**POST request:** `{ person_name, occasion_type, date, is_recurring, linked_wishlist_url? }` — `date` uses the same future/≤5-years validation as occasion dates. `linked_wishlist_url` (optional) is a pasted `/w/[id]` share link; the server resolves it to `linked_wishlist_id` via `gifvtme_get_shared_wishlist` and returns 400 if it can't be resolved. On success, schedules 14-day/3-day owner reminders when the date is in the future.
**Response:** `{ date }` with 201.

## `/api/important-dates/[id]`
**Methods:** PATCH, DELETE. **Auth:** required, must own the date. **Purpose:** edit or delete a saved important date.
**PATCH request:** partial, same shape as POST (`linked_wishlist_url` re-resolves; passing `""` clears the link). A changed `date` deletes unsent reminders and reschedules.
**DELETE behavior:** hard-deletes the row (no soft-archive — this is a personal note list, not purchase-linked) in a single statement; `reminders.important_date_id`'s `ON DELETE CASCADE` (migration 015) removes every reminder that pointed at it, sent or unsent, as part of the same delete. **Response:** `{ deleted: true }`.

## `/api/reminders`
**Method:** POST. **Auth:** protected by `Authorization: Bearer ${CRON_SECRET}` header, not user auth — called by Vercel Cron once daily (`vercel.json`, `0 6 * * *`) — Vercel's Hobby plan only permits daily cron schedules, so this doesn't run hourly despite earlier notes assuming that cadence.
**Purpose:** expires wishlist item intent flags older than 24 hours, then processes due `email`-channel reminders (`sent = false`, `permanently_failed = false`, `scheduled_at <= now()`, oldest-first, capped at 50 per run) — builds the subject/body per `reminder_type` and source (`important_date_id` / `occasion_id` / `invite_id`) via `buildReminderEmail`, sends through Resend, and on success sets `sent = true, sent_at = now()`. A send failure increments `retry_count` and sets `permanently_failed = true` once it reaches 5 (no further retries after that). If a reminder's parent row (important date/occasion/invite) was deleted while queued, the reminder is deleted outright rather than retried. After a `days_before = 3` owner reminder tied to a recurring `important_date_id` sends successfully, the important date advances to next year (Feb 29 → Feb 28 in non-leap years) and reschedules.
**Concurrency safety:** each due reminder is atomically claimed (`claimed_at`, a conditional `UPDATE ... WHERE claimed_at IS NULL OR claimed_at < staleThreshold`) before it's processed, so two overlapping invocations of this route can't both send the same reminder — a claim older than 10 minutes is treated as abandoned and re-claimed. The Resend send itself passes the reminder's own id as an `Idempotency-Key`, so if a send actually reached Resend but the response was lost (timeout, network error) and the reminder gets retried, Resend dedupes it instead of sending a second email — this is what makes it safe to leave a reminder `sent = false` (and therefore retryable) whenever the post-send bookkeeping update fails, rather than risking either a lost send or a duplicate one.
**`push`-channel reminders are not processed** — push delivery isn't built, so those rows are left queued and only counted, not attempted.
**Response:** `{ processed: number, failed: number, deferred: number }` — `processed` is reminders successfully sent this run, `failed` is reminders that failed this run (including ones that just became `permanently_failed`), `deferred` is the count of still-queued `push`-channel due reminders.

## `/api/reminders/unsubscribe`
**Method:** GET. **Auth:** none (token-based — must work from an email client with no session). **Purpose:** the unsubscribe link included in every reminder email.
**Query params:** `token` (the reminder's `important_date_id`/`occasion_id` for `type=owner`, or `invite_id` for `type=invitee`), `type` (`owner` | `invitee`).
**Behavior:** `type=owner` deletes all unsent `occasion_owner` reminders matching that `important_date_id` or `occasion_id`. `type=invitee` sets `wishlist_invites.reminder_opted_in = false` for that invite and deletes its unsent `invitee` reminders.
**Response:** a small HTML confirmation page (200), or 400/500 with an HTML error page on a missing/invalid token or a database failure.

## `/api/cart/prices`
**Method:** GET. **Auth:** none. **Purpose:** refreshes current Sanity prices for catalog cart items and returns four recommended products for the cart page.
**Query params:** `ids` as comma-separated Sanity product IDs.
**Response:** `{ products, recommended_products }`, where `products` contain active pricing/variant fields from `CART_PRICES_QUERY` and `recommended_products` are normalized `ProductCardData` rows.

## `/api/checkout`
**Method:** POST. **Auth:** required. **Purpose:** creates a pending catalog order, snapshots server-fetched Sanity prices into `order_items`, and initiates a Flutterwave hosted payment.
**Headers:** `Idempotency-Key` (required) — a client-generated opaque string, unique per logical checkout attempt.
**Request:** `{ cart_items, shipping, preferred_payment?, wishlist_item_id? }`. `cart_items[]` includes `{ catalog_product_id, combination_key, quantity, display_price }`, but `display_price` is ignored server-side except for request validation.
**Response:** `{ order_id, payment_link }` — `payment_link` is `null` when the matched order (see below) is already past `pending_payment`/`payment_failed` (e.g. `confirmed`) and has nothing left to pay.
**Critical:** fetches prices from Sanity using `CART_PRICES_QUERY` and never trusts client-submitted prices. Creates `orders.status = 'pending_payment'` and `order_items.unit_price` before contacting Flutterwave. If Flutterwave initiation fails, returns 502 while leaving the order retryable.
**Idempotency:** before creating anything, looks up an existing order by `idempotency_key` + `buyer_id` (`orders.idempotency_key`, migration 017). If one exists, no new order/order_items are created — the route re-initiates Flutterwave payment against that existing order (via the same `reinitiateOrderPayment` helper `/api/checkout/retry` uses, `lib/checkout/reinitiatePayment.ts`) and returns its `order_id`. A `23505` unique-violation on the create call (concurrent request racing with the same key) is handled the same way rather than surfacing a 500. The client (`CheckoutForm.tsx`'s `getCheckoutSignature`) derives the key from a signature of every field that defines the order — `wishlist_item_id`, each cart line's `catalog_product_id`/`combination_key`/`quantity`, and every Zod-normalized `shipping` field (name, email, phone, address, city, state, postal code, delivery instructions) — regenerating the key whenever any of them changes, and reusing it otherwise. So a network retry or double-submit of the *identical* cart and shipping reuses the original order instead of creating a duplicate, but a different cart **or** a shipping correction (e.g. fixing a typo'd phone number before resubmitting) gets a fresh key rather than silently replaying stale shipping details against the original order. There's no server-side requirement that a re-submitted body match the original order snapshot — the replay path always pays for the *original* order as created; it's the client's signature that's responsible for only reusing the key when nothing that matters has changed.
**Atomicity:** the `orders` row and its `order_items` are created together via one RPC call, `gifvtme_create_checkout_order` (migration 018), rather than two separate inserts — this runs as a single Postgres transaction, so no concurrent request (including the idempotency lookups above) can ever observe an order that exists without its items. Payment is only initiated after that call succeeds.
**Payment claim:** creating a new order also sets `orders.payment_claimed_at = now()` (part of the same RPC call, migration 018) — without this, a concurrent idempotent replay landing in the instant between that transaction committing and this request's own `initiateFlutterwavePayment` call could start a *second*, independent Flutterwave payment session for the same order. Every re-initiation (both `/api/checkout`'s replay path and `/api/checkout/retry`) goes through `reinitiateOrderPayment` (`lib/checkout/reinitiatePayment.ts`), which atomically claims the order first — a conditional `UPDATE ... WHERE status IN ('pending_payment','payment_failed') AND (payment_claimed_at IS NULL OR payment_claimed_at < now() - 2min)`, checked for an affected row — before calling Flutterwave. A losing claim (another request already has a live one) returns 409 without touching Flutterwave. The claim is released (`payment_claimed_at = null`) whenever a Flutterwave call fails, so a genuine retry right after a failure isn't blocked. This is the same `claimed_at` compare-and-set pattern `/api/reminders` and `/api/thank-you/process` already use for cron rows, just with a much shorter (2 minute, vs. 10 minute) staleness window since this guards an interactive user action rather than a background job.

## `/api/checkout/retry`
**Method:** POST. **Auth:** required, must own order. **Purpose:** re-initiates Flutterwave payment for an existing `pending_payment` or `payment_failed` order without creating a new order.
**Query params:** `order` UUID.
**Response:** `{ order_id, payment_link }`.
**Failure shape:** non-owned/missing orders return 404; non-retryable statuses return `{ error: "This order cannot be retried" }` with 400.

## `/api/flutterwave/webhook`
**Method:** POST. **Auth:** none via user session — verified via Flutterwave's `verif-hash` header before body parsing. **Purpose:** receives payment confirmation/failure events from Flutterwave and updates the corresponding `orders.status` to `confirmed` or `payment_failed`.
**Behavior:** ignores unknown orders and duplicate/non-pending orders idempotently with 200. Successful events only confirm the order when the webhook amount and currency match the stored order total and currency. Successful catalog wishlist orders mark the linked `wishlist_items` row, and any linked `master_items` row, as `purchased`.
**Critical:** makes zero database reads or writes before the signature check passes. See `THIRD_PARTY_INTEGRATIONS.md` for the verification mechanism.

## `/api/orders`
**Method:** GET. **Auth:** required. **Purpose:** lists the current user's tracked orders (`16-ORDER-TRACKING.md`) for `/account/orders`.
**Query params:** `?status=active|completed|cancelled` (maps to `STATUS_GROUPS` in `lib/orders/types.ts`; omitted returns every tracked order, all groups, newest first).
**Response:** `{ orders: OrderCardData[] }`. `pending_payment`/`payment_failed` orders are never included — those are still being resolved on `/checkout/processing`/`/checkout/failed`, not part of any tracking tab. The spec's tab list omits where `refunded` belongs; this repo groups it into `cancelled` (a refund is always downstream of an order that stopped shipping).

## `/api/orders/[id]`
**Method:** GET. **Auth:** required (owner — filtered by `buyer_id`, never a 403). **Purpose:** fetches a single order with items and status history for `/account/orders/[id]`.
**Response:** `{ order: OrderDetail }` — includes shipping fields, tracking fields, `order_items`, and `order_status_history` (oldest first). Missing/non-owned orders return 404 `{ error: "This order doesn't exist." }`.

## `/api/orders/notify` (cron route)
**Method:** POST. **Auth:** protected by `Authorization: Bearer ${CRON_SECRET}` header, not user auth. Spec text (`16-ORDER-TRACKING.md`) calls for this to run every 5 minutes; scheduled daily instead (`vercel.json`, `30 6 * * *`) for the same reason `/api/reminders` and `/api/thank-you/process` are daily — Vercel's Hobby plan only permits daily cron schedules. A customer status email can now take up to ~24h to arrive rather than ~5 minutes; revisit if the project moves to a Pro plan.
**Purpose:** sends pending customer-facing status emails — queries `order_status_history WHERE customer_notified = false AND permanently_failed = false AND status IN ('confirmed','shipped','delivered','cancelled','refunded')`, builds the email via `buildOrderStatusEmail` (`lib/orders/buildOrderStatusEmail.ts`), sends through Resend, and sets `customer_notified = true` on success.
**Concurrency safety:** identical `claimed_at` atomic-claim pattern to `/api/reminders`/`/api/thank-you/process` (not in the spec's literal `Database Changes` SQL, added because it's the same class of correctness gap the checkout race fixes closed — see `ROADMAP.md`). A send failure increments `retry_count` and sets `permanently_failed = true` at 5 (Edge Case #4). The Resend send passes the history row's own id as an `Idempotency-Key`.
**Response:** `{ notified: number, failed: number }`.

## `/api/orders/[id]/status` (not built — intentionally)
**Method:** PATCH (never implemented). Per `16-ORDER-TRACKING.md`'s Permissions section: "All writes to `orders.status` happen via Retool with service role — no customer-facing status-change API." Retool writes directly to Supabase; `validate_order_status_transition` (migration 019) enforces valid transitions at the DB level regardless of writer, and `on_order_status_changed` (same migration) logs every change to `order_status_history` automatically. No Next.js route is needed unless a future requirement (e.g. triggering something synchronously on status change) can't be met by Retool's direct write.

## `/api/purchases`
**Method:** POST. **Auth:** required. **Purpose:** the external-flow "mark as purchased" action — creates a `purchases` row after a giver confirms they completed an affiliate purchase.
**Request:** `{ wishlist_item_id: string }`.
**Behavior:** verifies the item exists, is still available, and has `origin = "external"`; inserts `{ wishlist_item_id, buyer_id }`. The `on_purchase_created` DB trigger handles marking the item/master item purchased and creating the automated thank-you record. Missing/archived items return 404; an item already marked `purchased` (read-time check or a unique-constraint race at insert time) returns 409 with a user-friendly "someone else just claimed this" message.

## `/api/thank-you/process` (cron route)
**Method:** POST. **Auth:** protected by `Authorization: Bearer ${CRON_SECRET}` header, not user auth — called by Vercel Cron once daily (`vercel.json`, `15 6 * * *`). Originally every 5 minutes per `12-THANK-YOU-MESSAGES.md`; changed to daily 2026-08-06 because Vercel's Hobby plan only permits daily cron schedules — a thank-you email can now take up to ~24h to send rather than ~5 minutes. Revert to a shorter interval if the project moves to a Pro plan.
**Purpose:** sends pending automated (`type = 'auto'`) `thank_you_messages` rows via Resend — one created by the pre-existing, unsourced `on_purchase_created` trigger per external purchase, or by the new `on_order_confirmed_thank_you` trigger per confirmed wishlist-originated catalog order. Builds the subject/body via `buildAutoThankYouEmail`, resolves the buyer's email via `auth.admin.getUserById` (service client), and on success sets `sent = true, sent_at = now()`. A send failure increments `retry_count` and sets `permanently_failed = true` once it reaches 5. A missing buyer email is treated as permanently failed immediately (defensive — shouldn't happen).
**Concurrency safety:** identical pattern to `/api/reminders` — each row is atomically claimed (`claimed_at`, conditional `UPDATE`) before sending, and the Resend send passes the row's own id as an `Idempotency-Key`.
**Response:** `{ processed: number, failed: number }`.

## `/api/thank-you/[id]/personal`
**Method:** POST. **Auth:** required, must be the receiver of the referenced gift. **Purpose:** sends a receiver-composed personal thank-you immediately (not queued — a failure returns 500 and nothing is persisted, so nothing retries it; the UI's own "already sent" button-hiding is the only guard against a double-send, matching the spec's explicit no-hard-constraint design).
**Request:** `{ source: "purchase" | "order", message: string }` — `source` disambiguates which table `id` refers to (the spec's route only implied a single `id`, but a purchase id and an order id are both plain UUIDs with no reliable way to tell them apart otherwise).
**Response:** `{ sent: true }`. Missing/non-owned gifts return 404; a Resend failure or missing buyer email returns 500 with `{ error: "Couldn't send your message. Please try again." }`.

## `/api/gifts`
**Method:** GET. **Auth:** required. **Purpose:** the "Gifts received" page's data source — renamed from the spec's `/api/dashboard/gifts` since no route in this repo is namespaced under `/api/dashboard` (matches the flat `/api/important-dates` naming convention instead).
**Response:** `{ gifts: GiftReceived[] }` — merges external purchases and confirmed catalog orders (`confirmed`/`under_review`/`forwarded`/`shipped`/`delivered`) for the receiver's own wishlist items, each with `autoThankYouSent`/`personalThankYouSent` flags, sorted by purchase date descending.

## `/api/reviews` (to be built)
**Method:** POST. **Auth:** required. **Purpose:** create a review. Must verify the user has a completed order containing the referenced `catalog_product_id` before allowing the insert (business rule #13) — this check should happen in the route handler, not rely solely on RLS, since the verified-purchase logic is more complex than a simple ownership check.

## `/api/webhooks` (folder exists, currently empty)
Reserved for future webhook handlers beyond Flutterwave (e.g. if Resend or a dropshipping supplier API needs a webhook later). Currently unused — do not assume anything here is implemented.

## Auth callback (not under `/api` but functionally similar)
`app/(auth)/callback/route.ts` — handles Supabase's email confirmation and OAuth redirect, exchanges the code for a session, preserves a safe `redirect` param when present, redirects to `/wishlists` by default on success, or `/login?error=confirmation_failed` on failure.

## General conventions for new routes

Validate request bodies with Zod, matching the pattern in `/api/scrape`. Return `{ error: string }` with an appropriate status code on failure — never a bare 500 with no body. Server-side routes that need elevated database access should use `createServiceClient()` from `lib/supabase/server.ts`, but only when the operation genuinely needs to bypass RLS (e.g. system-triggered actions) — prefer the regular server client (`createClient()`) for anything acting on behalf of an authenticated user, so RLS stays the enforced boundary.
