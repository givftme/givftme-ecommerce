# Feature: Cart & Checkout

## Overview
Catalog-only (Flow B) e-commerce. Covers adding items to a client-side cart, reviewing and editing the cart, entering shipping details, processing payment via Flutterwave, and the post-payment states (processing, success, failure/retry). Never mixes with the affiliate (Flow A) transaction path. Price shown at checkout is always re-fetched from Sanity server-side — the client is never trusted for pricing.

---

## Goals
- Provide a smooth, mobile-first cart and checkout experience for Gifvtme catalog items.
- Never trust client-provided prices — always re-fetch and snapshot from Sanity at order creation.
- Create an auditable `orders` row before any payment redirect (covers abandoned payments).
- Handle payment failure gracefully with a retry path.
- Support pre-saved shipping addresses to reduce re-entry.

---

## User Stories
- As a shopper, I can add multiple catalog items to my cart and see a running total.
- As a shopper, I can adjust quantities or remove items from my cart.
- As a shopper, if a flash sale ends while something is in my cart, I see the updated price.
- As a shopper, I can select a saved shipping address or enter a new one at checkout.
- As a shopper, I proceed to Flutterwave to pay and return to a confirmation page.
- As a shopper, if payment fails, I see a clear error and can retry.

---

## Functional Requirements
1. Cart is client-side state (React context + localStorage persistence for logged-in users).
2. Cart stores: `catalog_product_id`, `variant_combination_key` (if applicable), `quantity`, display snapshot of `title`/`image_url`/`price_at_add` — but price shown is always re-fetched live from Sanity, not the `price_at_add` snapshot.
3. Checkout requires auth — unauthenticated users are redirected to login (cart preserved in localStorage).
4. `POST /api/checkout`: re-fetches all prices server-side from Sanity, creates `orders` row at `status='pending_payment'`, creates `order_items` rows with current prices snapshotted, calls Flutterwave to initiate payment, returns a Flutterwave checkout URL.
5. On Flutterwave payment success: webhook fires → `POST /api/flutterwave/webhook` verifies signature → sets `orders.status='confirmed'`.
6. On return from Flutterwave (redirect back): `/checkout/processing` page polls `GET /api/orders/[id]/status` until it sees `confirmed` or `payment_failed`.
7. On `confirmed`: redirect to `/checkout/success/[orderId]`.
8. On `payment_failed`: show `/checkout/failed` with a retry CTA.
9. Flash sale expiry during checkout: the server always uses the current Sanity price at `POST /api/checkout` time. If a sale expired between when the user added the item and when they submit checkout, they pay the regular price — shown as an update on the checkout summary before final submission if the price changed.

---

## Non-Functional Requirements
- The checkout flow must work on mobile Safari (most Nigerian users).
- Flutterwave redirect must use HTTPS in production — never HTTP.
- `POST /api/checkout` must be idempotent with a client-generated `idempotency_key` to prevent double-orders on network retries.

---

## UI Requirements

### `/cart` — Cart page

**Header:** "My Cart" + item count.

**Item list:**
Each line item:
- Product image (60×60), title, variant description (e.g. "Size: M, Color: Red")
- Current price (live from Sanity, not cached) — if different from when added, show "Price updated" badge
- Quantity stepper (`QuantityStepper` component, min 1, max 10)
- Remove button (×)

**Price summary panel:**
- Subtotal
- Shipping: "Calculated at checkout" (v1 — flat rate or free shipping determined at checkout)
- Total

**CTAs:**
- "Proceed to checkout" (filled, full width)
- "Continue shopping" (ghost)

**Empty cart:** Illustrated empty bag, "Your cart is empty", "Browse the gift museum" CTA.

**Price-changed banner:** If any item's current Sanity price differs from `price_at_add`: amber banner — "Some prices have updated since you added them to your cart."

### `/checkout` — Checkout page

**Two-column layout on desktop** (form left, order summary right). Single column on mobile.

**Step 1: Shipping details**
- Full name (text input)
- Phone number (text input, required — for delivery coordination)
- Address line 1 (text input)
- Address line 2 (optional)
- City (text input)
- State (select — Nigerian states list, 36 states + FCT)
- Saved addresses: if user has saved addresses, show a "Use a saved address" selector above the form; selecting one pre-fills the form.
- "Save this address" checkbox (checked by default).

**Step 2: Order summary** (right column / below form on mobile)
- Line items: image, title, variant, quantity, price
- Subtotal, shipping, total
- Flash sale prices shown if active at this moment

**Payment section:**
- "Pay ₦[total] with Flutterwave" (filled, full width)
- Flutterwave logo + "Secure payment" copy
- On click: shows spinner, calls `POST /api/checkout`, redirects to Flutterwave URL.

### `/checkout/processing` — Polling page

Shown while waiting for Flutterwave webhook to confirm/fail the order.
- Animated spinner
- "Confirming your payment…"
- Polls every 3 seconds (max 30 seconds / 10 polls)
- If still pending after 10 polls: show "Payment is taking longer than expected. We'll email you once confirmed." with "View your orders" link.

### `/checkout/success/[orderId]` — Success page
- "🎁 Order confirmed!" heading
- Order summary (items, total)
- "We'll email you when your order ships."
- CTAs: "Continue shopping", "View this order" → `/account/orders/[orderId]`

### `/checkout/failed` — Failed page
- "Payment unsuccessful"
- Reason (if Flutterwave provides one — e.g. "Insufficient funds")
- "Try again" CTA → returns to checkout with the same cart
- "Contact support" link

---

## Backend Logic

### Cart context (`lib/cart/CartContext.tsx`)
```typescript
interface CartItem {
  catalog_product_id: string
  variant_combination_key: string | null
  quantity: number
  // Display snapshot (NOT used for pricing):
  title: string
  image_url: string
  price_at_add: number
}

// Persisted to localStorage under key 'gifvtme_cart_<userId>'
// Re-hydrated on mount, synced on every change
```

### `POST /api/checkout`
```typescript
// 1. Auth check
// 2. Parse idempotency_key from header — check if order with this key already exists
const existing = await supabase.from('orders').select('id, status').eq('idempotency_key', key).single()
if (existing.data) return { order_id: existing.data.id } // idempotent response

// 3. Re-fetch prices from Sanity for all cart items
const sanityPrices = await fetchCurrentPrices(cartItems) // calls getActivePrice() per item

// 4. Validate all items are still available
for (const item of cartItems) {
  const sanityProduct = sanityPrices[item.catalog_product_id]
  if (!sanityProduct) throw new Error(`Product ${item.catalog_product_id} no longer available`)
  if (item.variant_combination_key) {
    const variant = sanityProduct.variants?.find(v => v.combinationKey === item.variant_combination_key)
    if (!variant?.available) throw new Error(`Variant no longer available`)
  }
}

// 5. Calculate server-side total
const total = cartItems.reduce((sum, item) => {
  return sum + (sanityPrices[item.catalog_product_id].currentPrice * item.quantity)
}, 0)

// 6. Create orders row (before Flutterwave redirect)
const order = await supabase.from('orders').insert({
  user_id: auth.uid(),
  status: 'pending_payment',
  total_amount: total,
  idempotency_key: key,
  shipping_name: body.shipping.full_name,
  shipping_phone: body.shipping.phone,
  shipping_address: body.shipping.address_line_1,
  shipping_address_2: body.shipping.address_line_2,
  shipping_city: body.shipping.city,
  shipping_state: body.shipping.state,
}).select().single()

// 7. Create order_items (with price snapshots)
await supabase.from('order_items').insert(cartItems.map(item => ({
  order_id: order.id,
  catalog_product_id: item.catalog_product_id,
  variant_combination_key: item.variant_combination_key,
  product_title: sanityPrices[item.catalog_product_id].title,
  product_image_url: sanityPrices[item.catalog_product_id].image_url,
  unit_price: sanityPrices[item.catalog_product_id].currentPrice,
  quantity: item.quantity,
  // total_price is a generated column: quantity * unit_price
})))

// 8. Save shipping address if requested
if (body.save_address) await saveAddress(auth.uid(), body.shipping)

// 9. Initiate Flutterwave payment
const flutterwaveResponse = await initFlutterwavePayment({
  tx_ref: order.id,
  amount: total,
  currency: 'NGN',
  customer: { email: user.email, name: body.shipping.full_name, phone_number: body.shipping.phone },
  redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/processing?order_id=${order.id}`,
})

return { order_id: order.id, payment_url: flutterwaveResponse.data.link }
```

### `POST /api/flutterwave/webhook`
```typescript
// 1. Verify signature
const hash = crypto.createHmac('sha256', process.env.FLUTTERWAVE_SECRET_HASH)
  .update(JSON.stringify(body)).digest('hex')
if (hash !== req.headers['verif-hash']) return 401

// 2. Check event type
if (body.event !== 'charge.completed') return 200 // ignore other events

// 3. Verify the order amount matches (secondary check)
const order = await supabase.from('orders').select('total_amount, status').eq('id', body.data.tx_ref).single()
if (!order.data) return 404
if (order.data.status !== 'pending_payment') return 200 // already processed (idempotent)
if (Math.abs(body.data.amount - order.data.total_amount) > 1) return 400 // amount mismatch

// 4. Update status
const newStatus = body.data.status === 'successful' ? 'confirmed' : 'payment_failed'
await supabase.from('orders').update({
  status: newStatus,
  flutterwave_transaction_id: body.data.id,
  flutterwave_tx_ref: body.data.tx_ref,
}).eq('id', body.data.tx_ref)

return 200
```

### `GET /api/orders/[id]/status` (for processing page polling)
```typescript
// Auth check — user must own the order
const order = await supabase.from('orders').select('status').eq('id', id).eq('user_id', auth.uid()).single()
return { status: order.data.status }
```

---

## Database Changes

**`orders` table** — add `idempotency_key` (migration update needed):
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
```

**`addresses` table** (new — not yet in any migration):
```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT, -- "Home", "Work", etc.
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX addresses_user_id_idx ON addresses(user_id);

-- Enforce only one default per user:
CREATE UNIQUE INDEX addresses_one_default_per_user ON addresses(user_id) WHERE is_default = true;
```

**`order_items` table** — verify `total_price` generated column exists:
```sql
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED;
```

---

## API Endpoints

### `POST /api/checkout`
**Auth:** required.
**Headers:** `Idempotency-Key: <uuid>` (client-generated).
**Body:**
```typescript
{
  cart_items: CartItemPayload[],
  shipping: ShippingDetails,
  save_address: boolean,
}
```
**Response:** `{ order_id: string, payment_url: string }`.

### `POST /api/flutterwave/webhook`
**Auth:** none (verified via `verif-hash` header).
**Body:** Flutterwave event payload.
**Response:** `200 OK` always (Flutterwave expects 200 to stop retrying).

### `GET /api/orders/[id]/status`
**Auth:** required (order owner).
**Response:** `{ status: OrderStatus }`.

---

## Permissions and Authorization
- Cart: entirely client-side — no auth needed to build a cart.
- `POST /api/checkout`: requires auth.
- `POST /api/flutterwave/webhook`: no user auth — verified via Flutterwave signature.
- `GET /api/orders/[id]/status`: requires auth, must own the order.
- `addresses` RLS: owner-only CRUD.

---

## Validation

```typescript
const checkoutSchema = z.object({
  cart_items: z.array(z.object({
    catalog_product_id: z.string().min(1),
    variant_combination_key: z.string().nullable(),
    quantity: z.number().int().min(1).max(10),
  })).min(1, "Cart is empty"),
  shipping: z.object({
    full_name: z.string().min(2).max(100),
    phone: z.string().min(7).max(20),
    address_line_1: z.string().min(5).max(200),
    address_line_2: z.string().max(200).optional(),
    city: z.string().min(2).max(100),
    state: z.enum(NIGERIAN_STATES), // array of all 36 states + FCT
  }),
  save_address: z.boolean().default(true),
})
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Product no longer available | Checkout returns 422: "One or more items in your cart are no longer available. Please remove them and try again." |
| Variant unavailable | Same as above |
| Flutterwave initiation fails | 500: "Payment service temporarily unavailable. Please try again in a moment." |
| Webhook signature invalid | 401 — log the attempt |
| Amount mismatch in webhook | 400 — log for investigation (potential fraud) |
| Polling times out (10 polls) | Show "payment taking longer than expected" message — order status will update via webhook eventually |
| Session expires mid-checkout | Redirect to login with redirect param — cart preserved in localStorage |

---

## Loading and Empty States

- **Cart page:** skeleton line items while re-fetching current prices.
- **Empty cart:** illustrated bag + "Your cart is empty" + CTA.
- **Checkout — submitting:** "Pay" button disabled + spinner + "Redirecting to payment..."
- **Processing page:** animated spinner + "Confirming your payment…"
- **Saved addresses loading:** skeleton rows in the address selector.

---

## Edge Cases

1. **Price changes (flash sale ends) between cart add and checkout submit.** The server re-fetches Sanity prices at `POST /api/checkout` time. If the price changed, the `order_items.unit_price` is the new price. The user should see the updated total on the checkout page before submitting — implement a "re-validate prices" call on the checkout page mount that compares current Sanity prices against cart `price_at_add` values and shows a banner if any changed.

2. **Cart has items from multiple Gifvtme occasions** (e.g. buying gifts for two different people). This is allowed — the `orders` table does not require all items to come from the same wishlist. However, `orders.wishlist_item_id` can only link to one wishlist item. For multi-wishlist-item orders: create one order with the primary `wishlist_item_id` (first item tied to a wishlist), or set it null if it's a direct shop purchase. **Decision needed: clarify how multi-recipient carts are handled.** Simplest v1 approach: each wishlist item in the cart that was from a specific person's list should trigger its own order — but that's complex. Defer this edge case and assume a single-wishlist-item cart for v1.

3. **Flutterwave webhook fires but the order was already confirmed** (duplicate webhook). The `if order.status !== 'pending_payment' return 200` guard handles this — idempotent behavior, no double-confirmation.

4. **User closes the tab after Flutterwave payment but before returning to `/checkout/processing`.** The webhook still fires and confirms the order. The user can find it in `/account/orders`.

5. **Flutterwave webhook is delayed significantly** (minutes/hours). The order sits at `pending_payment`. The `/checkout/processing` polling times out and shows the "taking longer than expected" message. This is accepted v1 behavior — the order confirms once the webhook arrives.

6. **Cart localStorage is cleared** (user clears browser data mid-checkout). Cart is lost. The `orders` row at `pending_payment` remains in the DB but there's no UI to resume it. A "resume pending order" flow is a future improvement.

---

## Analytics / Events
- `cart.item_added` (product_id, origin: from_wishlist | from_browse)
- `cart.item_removed`
- `cart.quantity_changed`
- `cart.price_updated_banner_shown` (items_changed: number)
- `checkout.started`
- `checkout.payment_initiated` (total_amount)
- `checkout.payment_succeeded`
- `checkout.payment_failed` (reason)
- `checkout.payment_timed_out` (order still pending after 10 polls)

---

## Testing Requirements

### Unit tests
- `getActivePrice`: all cases (no sale, active sale, expired sale, variants).
- Checkout Zod schema: all valid/invalid combinations.
- Flutterwave signature verification: correct and incorrect hashes.

### Integration tests
- `POST /api/checkout`: creates `orders` and `order_items` rows with server-fetched prices, never client prices.
- Idempotency: same `Idempotency-Key` twice → same `order_id` returned, no duplicate `orders` row.
- Webhook: `charge.completed` → `status='confirmed'`; non-successful status → `status='payment_failed'`.
- Invalid webhook signature → rejected.

### Manual QA
- Add items to cart, let a flash sale expire, go to checkout — verify updated prices shown.
- Complete a full Flutterwave sandbox payment — verify order confirmed, email sent.
- Fail a Flutterwave sandbox payment — verify `/checkout/failed` shown with retry option.
- Check that `order_items.unit_price` matches the Sanity price at the moment of checkout, not the `price_at_add` value.

---

## Acceptance Criteria
- [ ] Cart persists in localStorage across page reloads for authenticated users.
- [ ] `POST /api/checkout` always re-fetches prices from Sanity — never trusts client-provided prices.
- [ ] An `orders` row is created at `pending_payment` before any Flutterwave redirect.
- [ ] Flutterwave webhook correctly verifies signature before changing order status.
- [ ] A successful payment results in `orders.status = 'confirmed'` and an automated thank-you triggered.
- [ ] A failed payment shows `/checkout/failed` with a retry path.
- [ ] Duplicate webhooks don't double-confirm an order.

---

## Future Improvements
- Cart sync across devices (server-persisted cart).
- "Save for later" from cart.
- Coupon/discount code support.
- Multiple shipping addresses per order (buying for multiple people in one cart).
- Buy now, pay later (BNPL) via Flutterwave PayLater.
