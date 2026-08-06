# Feature: Cart & Checkout

**Status: shipped.** This file documents the actual implementation, not an aspirational spec — see "Divergences from the original spec" at the bottom for what changed and why. Checkout idempotency (originally a gap) was closed 2026-08-06; three other divergences (order-status polling design, saved addresses, the success route) were deliberately left as shipped after review — see that section.

## Overview
Catalog-only (Flow B) e-commerce. Covers adding items to a client-side cart, reviewing and editing the cart, entering shipping details, processing payment via Flutterwave, and the post-payment states (processing, success, failure/retry). Never mixes with the affiliate (Flow A) transaction path. Price shown at checkout is always re-fetched from Sanity server-side — the client is never trusted for pricing.

---

## Goals
- Provide a smooth, mobile-first cart and checkout experience for Gifvtme catalog items.
- Never trust client-provided prices — always re-fetch and snapshot from Sanity at order creation.
- Create an auditable `orders` row before any payment redirect (covers abandoned payments).
- Handle payment failure gracefully with a retry path.
- Dedupe a retried/duplicated checkout submission so it can't create two orders for the same attempt.

---

## User Stories
- As a shopper, I can add multiple catalog items to my cart and see a running total.
- As a shopper, I can adjust quantities or remove items from my cart.
- As a shopper, if a flash sale ends while something is in my cart, I see the updated price.
- As a shopper, I proceed to Flutterwave to pay and land on my order once it's confirmed.
- As a shopper, if payment fails, I see a clear error and can retry.

---

## Functional Requirements
1. Cart is client-side state — `components/cart/CartContext.tsx` (React context), persisted to `localStorage` under a single global key `gifvtme.catalog-cart` (not per-user — see divergences).
2. Cart line items store `catalog_product_id`, `combination_key` (nullable — the Sanity variant identifier), `quantity`, `selected_options`, and a display snapshot (`product_title`, `product_image_url`, `unit_price`, `supplier_product_id`). The cart/checkout-summary UI re-fetches current prices from Sanity via `GET /api/cart/prices` (`useCartPriceRefresh`) and patches the snapshot in place — the snapshot itself is never used as the source of truth at checkout.
3. Checkout requires auth — unauthenticated users are redirected to login (cart preserved in localStorage).
4. `POST /api/checkout`: requires an `Idempotency-Key` header; re-fetches all prices server-side from Sanity, creates `orders` row at `status='pending_payment'`, creates `order_items` rows with current prices snapshotted, calls Flutterwave to initiate payment, returns a Flutterwave checkout URL. See "Idempotency" below.
5. On Flutterwave payment success: webhook fires → `POST /api/flutterwave/webhook` verifies the `verif-hash` signature header → sets `orders.status='confirmed'`.
6. On return from Flutterwave (redirect back): `/checkout/processing` polls `orders.status` directly from Supabase (client-side, RLS-scoped) until it sees `confirmed` or `payment_failed` — see "Order status polling" below.
7. On `confirmed`: redirect to `/account/orders/[id]` (there is no separate `/checkout/success` route — see divergences).
8. On `payment_failed`: show `/checkout/failed` with a retry CTA that calls `POST /api/checkout/retry`.
9. Flash sale expiry during checkout: the server always uses the current Sanity price at `POST /api/checkout` time. If a sale expired between when the user added the item and when they submit checkout, they pay the regular price — `useCartPriceRefresh` shows a banner on both `/cart` and `/checkout` when any line's live price differs from its snapshot.

### Idempotency
`orders.idempotency_key` (migration 017, nullable text with a partial unique index) is set from the client-generated `Idempotency-Key` header. `CheckoutForm.tsx` derives the key from a signature of the cart contents (`catalog_product_id:combination_key:quantity` per line, plus the linked wishlist item id) — it generates a fresh key only when that signature changes, so a resubmit of the *same* cart/shipping (double-click, network retry) reuses the key while a genuinely different cart gets a new one.

Server-side, `POST /api/checkout` looks up an existing order by `idempotency_key` + `buyer_id` before doing anything else:
- If found and still `pending_payment`/`payment_failed`: no new order or order_items are created — it re-initiates Flutterwave payment for that existing order (`lib/checkout/reinitiatePayment.ts`, shared with `/api/checkout/retry`) and returns its `order_id`.
- If found and already resolved (e.g. `confirmed`): returns `{ order_id, payment_link: null }` — the client falls through to `/checkout/processing`, which will pick up the already-confirmed status.
- A `23505` unique-violation on insert (two concurrent requests racing with the same key) is handled the same way as a normal replay rather than surfacing a 500.

This does **not** attempt to reconcile a replayed request whose cart differs from the original — the replay path always pays for the order as originally created, on the assumption that the key is only reused for retries of the *same* submission, never a materially different one (enforced client-side via the signature check above).

---

## Non-Functional Requirements
- The checkout flow must work on mobile Safari (most Nigerian users).
- Flutterwave redirect must use HTTPS in production — never HTTP.
- `POST /api/checkout` is idempotent via the `Idempotency-Key` header described above.

---

## UI Requirements

### `/cart` — Cart page

**Header:** "My Cart" + item count.

**Item list:**
Each line item:
- Product image, title, selected variant options
- Current price (live from Sanity via `/api/cart/prices`, not cached)
- Quantity stepper (`QuantityStepper` component, min 1, max 99)
- Remove button

**Price summary panel:**
- Subtotal / Total (shipping is not itemized separately in v1 — Flutterwave collects the order total, delivery cost is not currently broken out on this panel)

**CTAs:**
- "Proceed to checkout" (filled, full width)
- "Continue shopping" (ghost)

**Empty cart:** empty-state illustration, "Your cart is empty", browse CTA.

**Price-changed banner:** `useCartPriceRefresh`'s `priceNotice`, shown when any line's live Sanity price differs from its cached snapshot (worded differently depending on whether a flash sale just ended vs. a general price change).

### `/checkout` — Checkout page

**Two-column layout on desktop** (form left, order summary right). Single column on mobile.

**Shipping details form** (`CheckoutForm.tsx` / `lib/checkout/validation.ts`'s `checkoutShippingSchema`):
- First name, last name (separate fields, not a single `full_name`)
- Email address
- Phone number (Nigerian format, required)
- Street address, apartment/suite (optional)
- City, State (select — `NIGERIAN_STATES`, 36 states + `"FCT - Abuja"`)
- Postal code (optional), delivery instructions (optional)
- Saved addresses: `AddressSelector` component exists and is wired into the form, but is always given an empty array (`app/checkout/page.tsx`) — there's no `addresses` table or account UI to populate it from yet. See "Saved addresses" under divergences.

**Order summary** (right column / below form on mobile): line items, total, live prices, a price-changed notice, and an unavailable-items warning that blocks submission until resolved.

**Payment section:**
- Payment method selector (`PaymentMethodSelector` — card / bank transfer / USSD, passed to Flutterwave as `preferred_payment`)
- "Place order ₦[total]" button — disabled while submitting, while cart prices are refreshing, while any item is unavailable, or while the cart is empty/zero-total
- On click: validates the form and cart, sends `POST /api/checkout` with a stable `Idempotency-Key`, then either redirects to the returned Flutterwave `payment_link` or (if the order was already resolved via idempotent replay) pushes to `/checkout/processing`.

### `/checkout/processing` — Polling page
Shown while waiting for Flutterwave webhook to confirm/fail the order (`components/order/ProcessingScreen.tsx`).
- Animated spinner, "Confirming your payment…"
- Polls Supabase directly every **2 seconds**, for up to **3 minutes** (not the header-endpoint/10-poll design originally proposed — see divergences)
- On `confirmed`: redirects to `/account/orders/[id]`
- On `payment_failed`: redirects to `/checkout/failed?order=...`
- On timeout: shows a "taking longer than expected" state with a link to `/account`

### `/account/orders/[id]` — Order confirmation / status page
Serves as both the "success" page and the general order-status page. Redirects back to `/checkout/processing` if the order is still `pending_payment`, or to `/checkout/failed` if `payment_failed`; otherwise renders the confirmed order (`OrderConfirmationScreen`). There is no separate `/checkout/success/[orderId]` route.

### `/checkout/failed` — Failed page (`components/order/PaymentFailedScreen.tsx`)
- "Payment did not go through" (or a `reason` query param, currently never populated — neither `/api/checkout` nor the webhook attach a failure reason to the redirect)
- "Try again" CTA → calls `POST /api/checkout/retry?order=<id>` and redirects to the returned payment link
- "Contact support" link → `/contact-us`

---

## Backend Logic

### Cart context (`components/cart/CartContext.tsx`)
```typescript
export interface CartItem {
  catalog_product_id: string;
  product_title: string;
  product_image_url: string | null;
  combination_key: string | null;
  selected_options: Record<string, string>;
  quantity: number;
  unit_price: number;
  supplier_product_id: string | null;
}

// Persisted to localStorage under the single key "gifvtme.catalog-cart"
// (CART_STORAGE_KEY) — re-hydrated on mount, synced on every change.
```

### `POST /api/checkout` (`app/api/checkout/route.ts`)
1. Auth check (`getAuthenticatedApiUser`) — 401 if unauthenticated.
2. Requires an `Idempotency-Key` header — 400 if missing.
3. Validates the body against `checkoutSchema`.
4. Looks up an existing order by `idempotency_key` + `buyer_id`. If found, short-circuits into the idempotent-replay path described above — skips straight to Flutterwave initiation against the existing order, no new `orders`/`order_items` rows.
5. If a `wishlist_item_id` is present, validates it's `catalog` origin, `available`, and matches a cart line (400/404/409 on failure).
6. Re-fetches current product/variant state from Sanity (`CART_PRICES_QUERY`) and rejects (400, with an `unavailable_items` list) if any product is inactive or any selected variant is unavailable.
7. Computes server-side prices via `getActivePrice()` per line and the order total — rejects if any price is invalid or the total is zero.
8. Inserts the `orders` row (`status: 'pending_payment'`, `idempotency_key` set) before inserting `order_items`. If the `order_items` insert fails, the just-created order is deleted (best-effort compensation, not a DB transaction).
9. Calls `initiateFlutterwavePayment()`. On failure, returns 502 and **leaves the order at `pending_payment`** so it stays retryable via `/api/checkout/retry`.
10. Returns `{ order_id, payment_link }`.

### `POST /api/checkout/retry` (`app/api/checkout/retry/route.ts`)
Not part of the original design (which assumed retries resubmitted `/api/checkout` with the same idempotency key) — this is a dedicated, separately-designed endpoint that re-initiates payment for an *existing* order by id, without touching Sanity or re-validating cart contents:
1. Auth + ownership check (order must belong to the caller).
2. Only allows `pending_payment`/`payment_failed` orders.
3. Flips `payment_failed` → `pending_payment`, then calls `initiateFlutterwavePayment()` again with the order's stored shipping/amount.
4. Shares its re-initiation logic with `/api/checkout`'s idempotent-replay path via `lib/checkout/reinitiatePayment.ts`.

### `POST /api/flutterwave/webhook` (`app/api/flutterwave/webhook/route.ts`)
1. Verifies the `verif-hash` header against `FLUTTERWAVE_SECRET_HASH` via direct string comparison — this is Flutterwave's actual webhook contract (a static shared-secret header), not an HMAC-of-body scheme. Runs before any DB access.
2. Ignores any event that isn't `charge.completed`.
3. Resolves the order id from the payment's `meta.order_id` (falling back to parsing it out of `tx_ref`) — not by treating `tx_ref` itself as the order id.
4. Loads the order; if it's not `pending_payment`, returns 200 without modifying anything (idempotent against duplicate webhooks).
5. Requires the webhook's amount and currency to exactly match the stored order (normalized to integer kobo) before confirming.
6. On success: sets `status = 'confirmed'`, stores `flutterwave_tx_id`/`flutterwave_tx_ref`, and (if the order has a `wishlist_item_id`) marks the linked `wishlist_items` row — and its `master_items` row, if any — `purchased`.
7. On any other charge status: sets `status = 'payment_failed'`.
8. Always returns 200 except on signature mismatch (401), per Flutterwave's retry-suppression expectation.

### `GET /api/orders/[id]/status`
Does not exist. `/checkout/processing` polls `orders.status` directly from the browser via the RLS-scoped Supabase client instead — see divergences.

---

## Database Changes

`orders` and `order_items` existed live before this repo's migration history began (like `thank_you_messages`/`important_dates` before their own migrations) — there's no single migration file that creates them from scratch. Confirmed columns in use: `id`, `buyer_id`, `total_amount`, `currency`, `status`, `shipping_name`, `shipping_email`, `shipping_phone`, `shipping_address`, `shipping_city`, `shipping_state`, `wishlist_item_id`, `flutterwave_tx_id`, `flutterwave_tx_ref`, `created_at`; `order_items.total_price` is a generated column (`quantity * unit_price`).

**Migration 017** (`gifvtme_migration_017_checkout_idempotency.sql`) adds the one new column:
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**`addresses` table:** not built. See divergences.

---

## API Endpoints

### `POST /api/checkout`
**Auth:** required. **Headers:** `Idempotency-Key` (required).
**Body:** `{ cart_items, shipping, preferred_payment?, wishlist_item_id? }` — see `lib/checkout/validation.ts`'s `checkoutSchema` for exact shapes.
**Response:** `{ order_id, payment_link }` (`payment_link` is `null` on an idempotent replay against an already-resolved order).

### `POST /api/checkout/retry`
**Auth:** required, must own the order. **Query params:** `order` (UUID).
**Response:** `{ order_id, payment_link }`.

### `POST /api/flutterwave/webhook`
**Auth:** none (verified via `verif-hash` header). **Response:** `200 OK` always (except 401 on bad signature).

### `GET /api/cart/prices`
**Auth:** none. **Purpose:** refreshes current Sanity prices/availability for cart items; also returns recommended products for the cart page. Not in the original spec, but is what actually powers the price-changed banner and unavailable-item detection on both `/cart` and `/checkout`.

`GET /api/orders/[id]/status` — not built. See divergences.

---

## Permissions and Authorization
- Cart: entirely client-side — no auth needed to build a cart.
- `POST /api/checkout`, `POST /api/checkout/retry`: require auth (retry also requires order ownership).
- `POST /api/flutterwave/webhook`: no user auth — verified via Flutterwave signature.
- `/checkout/processing`'s direct Supabase polling relies on RLS to scope `orders` rows to their buyer.

---

## Validation

Actual shape (`lib/checkout/validation.ts`):
```typescript
export const checkoutCartItemSchema = z.object({
  catalog_product_id: z.string().trim().min(1),
  combination_key: z.string().trim().min(1).nullable(),
  quantity: z.number().int().min(1).max(99),
  display_price: z.number().positive(), // display-only, never trusted server-side
});

export const checkoutShippingSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().regex(/^(\+234|0)[789][01]\d{8}$/),
  street_address: z.string().trim().min(5),
  apartment: /* optional */ z.string().optional(),
  city: z.string().trim().min(2),
  state: /* one of NIGERIAN_STATES */ z.string(),
  postal_code: /* optional */ z.string().optional(),
  delivery_instructions: /* optional, max 500 */ z.string().optional(),
});

export const checkoutSchema = z.object({
  cart_items: z.array(checkoutCartItemSchema).min(1),
  shipping: checkoutShippingSchema,
  preferred_payment: z.enum(["card", "banktransfer", "ussd"]).optional(),
  wishlist_item_id: z.string().uuid().optional(),
});
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Product no longer available | 400 with `{ error: "Some items are no longer available", unavailable_items: [...] }` |
| Variant unavailable | Same as above, per-line reason ("Variant is no longer available" / "Variant is sold out") |
| Flutterwave initiation fails | 502: `"Payment couldn't start - try again."` — order stays `pending_payment`, retryable |
| Webhook signature invalid | 401 — logged, zero DB access before this check |
| Amount/currency mismatch in webhook | Logged, order left `pending_payment` (not confirmed) rather than a hard 400 |
| Polling times out (3 minutes) | "Taking longer than expected" — order still updates via webhook eventually |
| Session expires mid-checkout | Redirect to login — cart preserved in localStorage |
| Missing `Idempotency-Key` header | 400: `"Missing Idempotency-Key header."` |
| Concurrent duplicate submission (same key) | Handled as an idempotent replay, not a 500 |

---

## Loading and Empty States

- **Cart page:** price refresh runs in the background (`isRefreshingPrices`); no full-page skeleton.
- **Empty cart:** illustrated empty state + CTA.
- **Checkout — submitting:** "Place order" button disabled + spinner + "Processing...".
- **Processing page:** animated spinner + "Confirming your payment…".
- **Saved addresses:** not applicable — the selector never renders since it's always fed an empty list.

---

## Edge Cases

1. **Price changes (flash sale ends) between cart add and checkout submit.** `useCartPriceRefresh` re-fetches Sanity prices on both `/cart` and `/checkout` and patches the cart snapshot in place, showing a banner. The server independently re-fetches and re-prices at `POST /api/checkout` regardless of what the client showed.
2. **Cart has items from multiple Gifvtme occasions.** Same open question as originally noted — `orders.wishlist_item_id` links to at most one wishlist item; a cart mixing a wishlist-linked item with other items is allowed, but multi-recipient carts remain out of scope for v1.
3. **Duplicate Flutterwave webhook / duplicate checkout submission.** Both are idempotent — the webhook via its `status !== 'pending_payment'` guard, checkout submission via `idempotency_key` (see above).
4. **User closes the tab after paying but before returning to `/checkout/processing`.** The webhook still confirms the order; visible under `/account/orders`.
5. **Flutterwave webhook is delayed significantly.** Processing page times out after 3 minutes with a "check back" message; the order confirms once the webhook arrives.
6. **Cart localStorage is cleared mid-checkout.** Cart is lost; any `pending_payment` order has no resume UI. Unchanged from the original spec — still a future improvement.

---

## Analytics / Events

Actual event names in use (some differ from what was originally proposed):
- `cart.viewed`, `cart.prices_refreshed`, `cart.quantity_changed`, `cart.item_removed`
- `checkout.started`, `checkout.payment_method_selected`, `checkout.shipping_completed`, `checkout.unavailable_items`, `checkout.order_placed`
- `checkout.payment_succeeded`, `checkout.payment_failed` (fired from the processing page based on polled status)
- `checkout.payment_retried` (fired from the failed page's retry CTA)

Not currently fired: a dedicated `cart.item_added` event, and `checkout.payment_timed_out` for the processing-page timeout state.

---

## Testing Requirements

### Unit tests (shipped)
- `getActivePrice`/`isFlashSaleWindowActive` — `lib/flutterwave/getActivePrice.test.ts`
- `checkoutSchema` (cart items, shipping fields, phone/state/email validation, optional fields) — `lib/checkout/validation.test.ts`

### Integration tests (shipped)
- `POST /api/checkout` idempotency: missing header rejected, an existing `pending_payment` order is reused (payment re-initiated, no new order created), an existing resolved order returns `payment_link: null` — `app/api/checkout/route.test.ts`
- `POST /api/flutterwave/webhook`: signature required before any DB access, non-`charge.completed` events ignored, amount mismatch doesn't confirm, already-confirmed orders are untouched (idempotent), non-successful charges mark `payment_failed` — `app/api/flutterwave/webhook/route.test.ts`

### Manual QA (unchanged from original)
- Add items to cart, let a flash sale expire, go to checkout — verify updated prices shown.
- Complete a full Flutterwave sandbox payment — verify order confirmed.
- Fail a Flutterwave sandbox payment — verify `/checkout/failed` shown with retry option.
- Double-submit checkout (e.g. slow network, click twice) — verify only one order is created.

---

## Acceptance Criteria
- [x] Cart persists in localStorage across page reloads.
- [x] `POST /api/checkout` always re-fetches prices from Sanity — never trusts client-provided prices.
- [x] An `orders` row is created at `pending_payment` before any Flutterwave redirect.
- [x] Flutterwave webhook correctly verifies signature before changing order status.
- [x] A successful payment results in `orders.status = 'confirmed'`.
- [x] A failed payment shows `/checkout/failed` with a retry path.
- [x] Duplicate webhooks don't double-confirm an order.
- [x] A duplicated/retried `POST /api/checkout` submission (same `Idempotency-Key`) doesn't create a second order.

---

## Divergences from the original spec

Reviewed 2026-08-06 against already-shipped, architecture-documented code (`API_ROUTES.md`, `DATABASE_SCHEMA.md`, `ROADMAP.md`). Idempotency was a genuine gap and has been closed (migration 017 + the header/replay logic above). Three other divergences were deliberately kept as shipped rather than rewritten to match the original text:

1. **Order-status polling.** The original spec assumed a dedicated `GET /api/orders/[id]/status` endpoint for the processing page to poll. Shipped code instead polls Supabase directly from the browser via RLS, which already works and needs no new route. `API_ROUTES.md` still lists `/api/orders/[id]/status` as a possible future Retool/service-role endpoint (a different purpose — writing status, not customer polling), not something the processing page needs.
2. **Saved addresses.** The `addresses` table and a working address-book flow were never built — this functionality is now scoped to its own spec, `20-ADDRESS-BOOK.md`, rather than this one. `AddressSelector`/`CheckoutForm` have UI scaffolding for it but are always fed an empty list.
3. **Success page.** No dedicated `/checkout/success/[orderId]` route exists; `/account/orders/[id]` serves as the confirmation page (it already handles all three post-payment states — pending, failed, confirmed — with its own redirects).

Cosmetic/naming-only divergences left as shipped: `combination_key` (not `variant_combination_key`), `payment_link` (not `payment_url`), cart context at `components/cart/` (not `lib/cart/`), a single global localStorage cart key (not per-user), separate first/last name fields (not `full_name`), and a `/api/checkout/retry` endpoint design for retries (not resubmitting `/api/checkout`).
