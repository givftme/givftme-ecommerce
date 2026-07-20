# Feature Spec: Cart & Checkout

**Project:** Gifvtme
**Module:** 07 — Commerce
**Priority:** Core
**Depends on:** Auth flow, Gift Museum (cart state from `CartContext`), Address Book. Supabase migrations 001–003 running. Flutterwave account set up with secret key and webhook hash.
**Agent instruction:** Implement both UI and backend logic together. Apply `RESPONSIVE_DESIGN_DIRECTIVE.md` for desktop adaptation. Mobile screenshots are the design source of truth. Make reasonable decisions where unspecified and note in comments. Do not ask for clarification.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Icons:** lucide-react
- **Forms:** react-hook-form + Zod
- **Animation:** GSAP + @gsap/react
- **Database:** Supabase (PostgreSQL with RLS)
- **Payments:** Flutterwave (REST API v3)
- **CMS:** Sanity (price verification at checkout time)
- **Path alias:** `@/` maps to `src/`

---

## Overview

This feature covers the complete purchase flow for Gifvtme catalog items — from a populated cart through to a confirmed order. External/affiliate wishlist items are never in this flow — they have their own redirect path.

Two critical rules that must never be violated:
1. **Prices are always server-fetched at order creation time** — never trust client-submitted prices (Business Rule #7)
2. **The webhook signature must be verified before any database writes** — never confirm an order based on an unverified webhook

The flow is: Cart → Checkout (shipping details + order summary) → Flutterwave payment → Webhook confirmation → Order confirmed → Confirmation page.

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Cart | `/cart` | Item list, quantities, total, checkout CTA |
| Checkout | `/checkout` | Shipping form + order summary + place order |
| Payment processing | `/checkout/processing` | Waiting for Flutterwave webhook |
| Order confirmation | `/account/orders/[id]` | Success state after payment confirmed |
| Payment failed | `/checkout/failed?order=[id]` | Failed payment with retry option |

---

## Detailed Screen Requirements

### Screen 1 — Cart (`/cart`)

**Layout:**
- Mobile: stacked item cards, sticky bottom checkout bar
- Desktop: two-column — item list (left, wider) + order summary (right, sticky)

**Header:**
- Back arrow (mobile only)
- "Cart" title (center)
- Menu/hamburger icon (top right)

**"Card Summary" section:**

Each cart item card:
- Product image (80px × 80px, `rounded-xl`)
- Product title (bold, truncated 1 line)
- Variant info below title (e.g. "Color: Red, Size: M") in muted small text
- Star rating (from Sanity — if product has reviews, show avg rating + star icon)
- Price (bold, formatted ₦X,XXX)
- Quantity stepper (`QuantityStepper` component) — left side
- Delete icon (lucide-react `Trash2`, brand red) — top right of card

**Checkout button (sticky bottom on mobile, in order summary on desktop):**
- "Checkout ₦[total]" (brand red, pill, full width)
- Disabled if cart is empty
- Requires auth — if not logged in, shows auth gate instead

**"Recommended for you" section (below cart items):**
- Section header: "Recommended for you"
- Filter pills: "Best Seller" | "On sale" | "New Arrivals" | "Top Rated"
- 2-column product grid (same `ProductCard` component)
- 4 products fetched from Sanity based on occasion types of items in cart

**Empty cart state:**
- Large cart illustration (lucide-react `ShoppingCart`, 80px, `#FEF2F2` background circle)
- "No items yet? Continue shopping to explore more"
- "Sign in" button (brand red, pill) — if not authenticated
- "Explore items" button (ghost, pill) — always shown, links to `/shop`

**Desktop order summary panel (right column, sticky):**
- "Order Summary" heading
- Line items list (condensed: title + qty + price)
- Subtotal
- Shipping: "FREE" (green text)
- Total (large, bold, brand red)
- "Checkout" button (brand red, pill, full width)

---

### Screen 2 — Checkout (`/checkout`)

**Auth gate:** Requires authentication. If not logged in, redirect to `/auth/login?redirect=/checkout`.

**Layout:**
- Mobile: single column — form first, summary below
- Desktop: two columns — form (left, wider) + sticky summary (right)

**Page title:** "Checkout details"

**Left column — Shipping form (react-hook-form + Zod):**

Saved address selector (shown only for authenticated users with saved addresses):
- Dropdown/select: "Use a saved address"
- Options: each saved address with its label ("Home", "Office", etc.)
- Selecting pre-fills all form fields below
- "Or enter a new address" link below selector

Form fields (2-column on desktop where noted):
- First Name (required) + Last Name (required) — side by side on desktop
- Country / Region — pre-filled "Nigeria", locked for v1 (not editable)
- Street address (required)
- Apt, suite, unit (optional, placeholder "apartment, suite, unit, etc.")
- City / Town (required) + State (required, dropdown of all 36 Nigerian states + FCT) — side by side on desktop
- Phone number (required, Nigerian format)
- Email address (required, pre-filled from user account, editable)
- Postal code (optional)
- Delivery instruction (textarea, optional, placeholder "e.g. ring the bell, leave at gate")
- "Set as default shipping address" checkbox (only shown if address differs from saved default)
- "Save this address" checkbox (only shown if not already saved)

**Right column — Order summary:**
- "Product" header | "Subtotal" header
- Each item: "[product title] × [qty]" | "₦[price]"
- Subtotal row
- Shipping row: "FREE" (green)
- Total row (bold, larger)

**Payment section (below summary on mobile, below form on desktop):**
- Radio options:
  - "Direct Bank Transfer" (with bank icon)
  - "Card Payment" (with credit card icon)
  - "USSD" (with phone icon)
- Note: All options go through Flutterwave — the radio selection is passed as a preference hint to Flutterwave's inline SDK, not a separate payment processor

**"Place order" button (brand red, pill, full width):**
- Validates shipping form first
- Shows "Processing…" + spinner while API call in flight
- On success: redirects to `/checkout/processing`

---

### Screen 3 — Payment Processing (`/checkout/processing`)

**This screen appears between the Flutterwave redirect and the webhook confirmation.**

**Layout:** Full screen, centered

**Content:**
- Animated loading indicator (GSAP rotating ring or pulsing dots)
- "Processing your payment…"
- "Please don't close this tab"

**Behavior:**
After "Place order" is clicked:
1. `/api/checkout` creates the `orders` row and returns a Flutterwave payment link
2. User is redirected to the Flutterwave hosted payment page
3. After payment, Flutterwave redirects back to `/checkout/processing?order=[orderId]`
4. This page polls the order status from Supabase every 2 seconds
5. When `orders.status` changes from `pending_payment` to `confirmed` → redirect to `/account/orders/[id]`
6. When `orders.status` changes to `payment_failed` → redirect to `/checkout/failed?order=[orderId]`
7. Timeout after 3 minutes → show "Taking longer than expected" message with a "Check my orders" link

**Polling implementation:**
```typescript
// Poll every 2 seconds for up to 3 minutes
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    if (data?.status === 'confirmed') {
      clearInterval(interval)
      router.push(`/account/orders/${orderId}`)
    }
    if (data?.status === 'payment_failed') {
      clearInterval(interval)
      router.push(`/checkout/failed?order=${orderId}`)
    }
  }, 2000)

  const timeout = setTimeout(() => {
    clearInterval(interval)
    setTimedOut(true)
  }, 180000) // 3 minutes

  return () => { clearInterval(interval); clearTimeout(timeout) }
}, [orderId])
```

---

### Screen 4 — Payment Failed (`/checkout/failed`)

**Layout:** Full screen, centered

**Content:**
- Large `XCircle` icon (lucide-react, 60px, red)
- "Payment didn't go through"
- Reason from Flutterwave if available (e.g. "Insufficient funds")
- "Try again" button (brand red, pill) — re-initiates payment for the same order ID
- "Contact support" link (muted, below)

**"Try again" behavior:**
- Calls `/api/checkout/retry?order=[orderId]`
- Re-initiates Flutterwave payment for the same existing order (does NOT create a new order)
- Redirects back to `/checkout/processing`

---

## Backend Requirements

### `POST /api/checkout`

This is the most critical route in the entire commerce flow. Must be implemented with extreme care.

```typescript
// 1. Auth check
const { data: { user } } = await supabase.auth.getUser()
if (!user) return 401

// 2. Parse and validate body
const body = CheckoutSchema.parse(await req.json())
// body: { cart_items, shipping }

// 3. RE-FETCH ALL PRICES FROM SANITY — never trust client prices
const productIds = body.cart_items.map(i => i.catalog_product_id)
const sanityProducts = await sanityFetch({
  query: CART_PRICES_QUERY,
  params: { ids: productIds }
})

// 4. Verify all products are still active
const unavailableItems = body.cart_items.filter(item => {
  const product = sanityProducts.find(p => p._id === item.catalog_product_id)
  return !product || product.status !== 'active'
})
if (unavailableItems.length > 0) {
  return 400, { error: 'Some items are no longer available', unavailable_items: unavailableItems }
}

// 5. Calculate server-side total
const totalAmount = body.cart_items.reduce((sum, item) => {
  const product = sanityProducts.find(p => p._id === item.catalog_product_id)
  const price = getActivePrice(product, item.combination_key) // checks flash sale window
  return sum + (price * item.quantity)
}, 0)

// 6. Create orders row (status='pending_payment')
const { data: order } = await supabase.from('orders').insert({
  buyer_id: user.id,
  total_amount: totalAmount,
  currency: 'NGN',
  status: 'pending_payment',
  shipping_name: `${body.shipping.first_name} ${body.shipping.last_name}`,
  shipping_email: body.shipping.email,
  shipping_phone: body.shipping.phone,
  shipping_address: body.shipping.street_address,
  shipping_city: body.shipping.city,
  shipping_state: body.shipping.state,
  wishlist_item_id: body.wishlist_item_id ?? null
}).select('id').single()

// 7. Create order_items rows with SERVER-FETCHED prices
for (const item of body.cart_items) {
  const product = sanityProducts.find(p => p._id === item.catalog_product_id)
  const unitPrice = getActivePrice(product, item.combination_key)
  await supabase.from('order_items').insert({
    order_id: order.id,
    catalog_product_id: item.catalog_product_id,
    product_title: product.title,
    product_image_url: product.images?.[0]?.url ?? null,
    supplier_id: product.supplier?._id ?? null,
    supplier_product_id: product.supplierProductId ?? null,
    quantity: item.quantity,
    unit_price: unitPrice
  })
}

// 8. Initiate Flutterwave payment
const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tx_ref: order.id,  // Use order ID as the Flutterwave reference
    amount: totalAmount,
    currency: 'NGN',
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/processing?order=${order.id}`,
    customer: {
      email: body.shipping.email,
      name: `${body.shipping.first_name} ${body.shipping.last_name}`,
      phonenumber: body.shipping.phone
    },
    customizations: {
      title: 'Gifvtme',
      description: `Order #${order.id.slice(0, 8)}`,
      logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`
    },
    payment_options: body.preferred_payment ?? 'card,banktransfer,ussd'
  })
})

const flwData = await flwResponse.json()
if (flwData.status !== 'success') {
  // Payment initiation failed — update order to reflect this
  await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', order.id)
  return 502, { error: 'Payment could not be initiated. Please try again.' }
}

return 200, { order_id: order.id, payment_link: flwData.data.link }
```

### `POST /api/flutterwave/webhook`

```typescript
// 1. Verify signature BEFORE ANYTHING ELSE
const signature = req.headers.get('verif-hash')
if (signature !== process.env.FLUTTERWAVE_SECRET_HASH) {
  return 401  // Do not log the body — it may be a probe
}

const payload = await req.json()

// 2. Only process successful payment events
if (payload.event !== 'charge.completed') return 200

// 3. Idempotency check — look up the order by tx_ref
const { data: order } = await supabase
  .from('orders')
  .select('id, status, flutterwave_tx_ref')
  .eq('id', payload.data.tx_ref)  // tx_ref is our order ID
  .single()

if (!order) return 200  // Unknown order — ignore
if (order.status !== 'pending_payment') return 200  // Already processed — idempotent

// 4. Check payment status from Flutterwave
if (payload.data.status === 'successful') {
  await supabase.from('orders').update({
    status: 'confirmed',
    flutterwave_tx_id: String(payload.data.id),
    flutterwave_tx_ref: payload.data.tx_ref
  }).eq('id', order.id)

  // If this order came from a wishlist item, mark the item as purchased
  const { data: fullOrder } = await supabase
    .from('orders')
    .select('wishlist_item_id, buyer_id')
    .eq('id', order.id)
    .single()

  if (fullOrder?.wishlist_item_id) {
    await supabase.from('wishlist_items')
      .update({ status: 'purchased' })
      .eq('id', fullOrder.wishlist_item_id)

    // Also mark the linked master_items row if applicable
    const { data: wishlistItem } = await supabase
      .from('wishlist_items')
      .select('master_item_id')
      .eq('id', fullOrder.wishlist_item_id)
      .single()

    if (wishlistItem?.master_item_id) {
      await supabase.from('master_items')
        .update({ status: 'purchased' })
        .eq('id', wishlistItem.master_item_id)
    }
  }
} else {
  // Payment failed
  await supabase.from('orders').update({
    status: 'payment_failed',
    flutterwave_tx_id: String(payload.data.id)
  }).eq('id', order.id)
}

// Always return 200 to Flutterwave — it will retry on non-200 responses
return 200
```

### `GET /api/checkout/retry`

```typescript
// Params: ?order=[orderId]
// Re-initiates Flutterwave payment for an existing pending_payment or payment_failed order

const { data: order } = await supabase
  .from('orders')
  .select('*, order_items(*)')
  .eq('id', orderId)
  .eq('buyer_id', userId)  // Must own the order
  .in('status', ['pending_payment', 'payment_failed'])
  .single()

if (!order) return 404

// Re-initiate Flutterwave with the same order ID and amount
// (same logic as POST /api/checkout step 8)
// Return { payment_link }
```

### `GET /api/cart/prices`

Used to refresh cart prices when the cart page opens:

```typescript
// Query params: ?ids=id1,id2,id3
const ids = searchParams.get('ids')?.split(',') ?? []

const products = await sanityFetch({
  query: CART_PRICES_QUERY,
  params: { ids }
})

// CART_PRICES_QUERY fetches: _id, basePrice, salePrice, saleStartTime, saleEndTime, hasVariants, variants[]{combinationKey, price, available}
return { products }
```

---

## Database Changes

No new tables needed. All tables exist in migrations 001 and 002.

**New environment variables required:**
```
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret_key
FLUTTERWAVE_SECRET_HASH=your_webhook_verification_hash
```

The agent must note in comments:
1. The Flutterwave webhook URL must be configured in the Flutterwave dashboard pointing to `[your-domain]/api/flutterwave/webhook`
2. The `FLUTTERWAVE_SECRET_HASH` is set in the Flutterwave dashboard under "Webhooks" — it is a custom string you define there AND in your env var
3. The Flutterwave account must be in Nigerian Naira (NGN) mode

**New GROQ query needed:**

```groq
// CART_PRICES_QUERY — add to lib/sanity/queries.ts
*[_type == "product" && _id in $ids] {
  _id,
  title,
  status,
  hasVariants,
  basePrice,
  baseCompareAtPrice,
  baseSku,
  salePrice,
  saleStartTime,
  saleEndTime,
  "variants": variants[] {
    combinationKey,
    price,
    compareAtPrice,
    supplierSku,
    available
  },
  "images": images[0..0] { asset, hotspot, alt },
  "supplier": supplier-> { _id, name },
  supplierProductId
}
```

---

## API Endpoints Summary

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/checkout` | Create order + initiate Flutterwave payment | Required |
| `POST` | `/api/flutterwave/webhook` | Receive payment confirmation from Flutterwave | Signature-verified |
| `GET` | `/api/checkout/retry` | Re-initiate payment for failed order | Required, must own order |
| `GET` | `/api/cart/prices` | Refresh current prices for cart items | Not required |

---

## File Structure

```
src/
  app/
    cart/
      page.tsx                        ← Cart page (client component for cart state)
    checkout/
      page.tsx                        ← Checkout form (client component)
      processing/
        page.tsx                      ← Payment processing polling page
      failed/
        page.tsx                      ← Payment failed + retry
    api/
      checkout/
        route.ts                      ← POST create order + initiate payment
        retry/
          route.ts                    ← GET re-initiate payment
      flutterwave/
        webhook/
          route.ts                    ← POST webhook handler
      cart/
        prices/
          route.ts                    ← GET refresh cart prices
  components/
    cart/
      CartContext.tsx                 ← Already built in gift museum spec
      CartItem.tsx                    ← Item card in the cart
      CartSummary.tsx                 ← Order summary panel (desktop sidebar)
      EmptyCart.tsx                   ← Empty state component
    checkout/
      CheckoutForm.tsx                ← Shipping details form
      AddressSelector.tsx             ← Saved address dropdown
      PaymentMethodSelector.tsx       ← Card/bank/USSD radio selection
      OrderSummaryPanel.tsx           ← Right-column summary on desktop
    order/
      ProcessingScreen.tsx            ← Animated processing page
      PaymentFailedScreen.tsx         ← Failed payment page
  lib/
    flutterwave/
      index.ts                        ← Flutterwave API helpers
      getActivePrice.ts               ← Flash sale price resolution helper
```

### `lib/flutterwave/getActivePrice.ts`

```typescript
// Determines the correct price for a product/variant considering flash sales
export function getActivePrice(
  product: SanityProduct,
  combinationKey: string | null
): number {
  const now = new Date()
  const saleActive =
    product.salePrice != null &&
    product.saleStartTime != null &&
    product.saleEndTime != null &&
    new Date(product.saleStartTime) <= now &&
    now <= new Date(product.saleEndTime)

  if (product.hasVariants && combinationKey) {
    const variant = product.variants?.find(v => v.combinationKey === combinationKey)
    if (!variant) throw new Error(`Variant not found: ${combinationKey}`)
    // Apply sale at product level even for variant products
    return saleActive ? (product.salePrice ?? variant.price) : variant.price
  }

  return saleActive ? (product.salePrice ?? product.basePrice ?? 0) : (product.basePrice ?? 0)
}
```

---

## Nigerian States List

```typescript
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
] as const
```

---

## Validation

### Checkout form
```typescript
const CheckoutSchema = z.object({
  cart_items: z.array(z.object({
    catalog_product_id: z.string(),
    combination_key: z.string().nullable(),
    quantity: z.number().int().min(1).max(99),
    // NOTE: client-submitted price is IGNORED server-side
    // It's included here only for UX display purposes before submission
    display_price: z.number().positive()
  })).min(1, 'Cart is empty'),
  shipping: z.object({
    first_name: z.string().min(1, 'First name required'),
    last_name: z.string().min(1, 'Last name required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number'),
    street_address: z.string().min(5, 'Enter your full street address'),
    city: z.string().min(2, 'City required'),
    state: z.enum(NIGERIAN_STATES, { errorMap: () => ({ message: 'Select a state' }) }),
    postal_code: z.string().optional(),
    delivery_instructions: z.string().max(500).optional()
  }),
  preferred_payment: z.enum(['card', 'banktransfer', 'ussd']).optional(),
  wishlist_item_id: z.string().uuid().optional()
})
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Cart is empty | Redirect to `/shop` |
| Cart item archived/unavailable in Sanity | Return 400 with `{ unavailable_items }` — show which items are gone, block checkout until removed |
| Flutterwave initiation fails | Return 502: "Payment couldn't start — try again." Keep the order at `pending_payment` so retry is possible |
| Flutterwave webhook signature invalid | Return 401, log the attempt, make zero DB changes |
| Webhook for already-confirmed order | Return 200, make no changes (idempotency) |
| Payment fails (Flutterwave reports failure) | Update order to `payment_failed`, redirect to `/checkout/failed` |
| Polling times out (3 minutes) | Show "Taking longer than expected" with a "Check my orders" link |
| User not authenticated at checkout | Redirect to `/auth/login?redirect=/checkout` |
| Retry on a non-retryable order status | 400: "This order cannot be retried" |
| Price changed between cart add and checkout | Server uses current price — show a price-changed notice in the UI if there's a difference |

---

## Loading States

| State | Implementation |
|---|---|
| Cart page initial | `CartContext` already has items — instant render |
| Price refresh on cart open | Prices update silently in background; show subtle "prices updated" note if any changed |
| "Place order" button | "Processing…" + `Loader2` spinner, full form disabled |
| Processing page | Animated pulsing ring (GSAP), polling in background |
| Retry button | "Retrying…" + spinner |

---

## GSAP Animations

| Element | Animation |
|---|---|
| Cart item removal | `gsap.to(item, { opacity: 0, x: 30, height: 0, marginBottom: 0, duration: 0.3 })` before removing from DOM |
| Cart item added (from product page) | Cart icon in navbar bounces: `gsap.to(cartIcon, { scale: 1.4, duration: 0.2, yoyo: true, repeat: 1 })` |
| Processing animation | `gsap.to(ring, { rotation: 360, duration: 1, ease: 'none', repeat: -1 })` |
| Success redirect | Brief scale-up on the confirmation icon: `gsap.from(icon, { scale: 0, duration: 0.5, ease: 'back.out(2)' })` |
| Payment failed icon | `gsap.from(xIcon, { scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(1.5)' })` |
| Price changed notice | `gsap.from(notice, { opacity: 0, y: -10, duration: 0.3 })` |

---

## Edge Cases

1. **Multiple tabs open — user checks out on both** — the second checkout call creates a second `orders` row. Both are valid pending_payment orders. If only one webhook fires, one is confirmed and the other stays pending. The ops team sees both in Retool. For v1, this is acceptable — the user will see two orders in their order history.

2. **Flash sale ends between cart add and checkout** — the server recalculates the price at checkout time. If the sale has ended, the regular price is used. Show the user a notice: "The flash sale for [item] ended — the regular price of ₦X,XXX has been applied."

3. **Product goes out of stock between cart add and checkout** — server validates all items against Sanity before creating the order. Out-of-stock items are returned in `unavailable_items` — the checkout is blocked until they are removed from the cart.

4. **Webhook fires before the user returns from Flutterwave** — the polling on `/checkout/processing` will catch the status change and redirect the user to the confirmation page. No data loss.

5. **User closes the browser after payment but before the redirect** — the webhook still fires from Flutterwave's server. The order is confirmed in the database. On next login, the user sees the confirmed order in their order history. The processing polling never runs — that's fine.

6. **Flutterwave sends the webhook twice** — idempotency check in the webhook handler catches this (order is already `confirmed`). Returns 200 with no DB changes.

7. **Order total is ₦0** — reject at the form level: cart must have at least one item with a positive price. If all items are somehow ₦0, block checkout with an error.

---

## Analytics Events

```typescript
'cart.viewed'                     // { item_count, total_value }
'cart.item_removed'               // { product_id }
'cart.quantity_changed'           // { product_id, old_qty, new_qty }
'cart.prices_refreshed'           // { items_with_price_changes: number }
'checkout.started'                // { item_count, total_value }
'checkout.shipping_completed'     // { has_saved_address: boolean }
'checkout.payment_method_selected'// { method: 'card' | 'banktransfer' | 'ussd' }
'checkout.order_placed'           // { order_id, total_value, item_count }
'checkout.payment_succeeded'      // { order_id, total_value }
'checkout.payment_failed'         // { order_id, reason }
'checkout.payment_retried'        // { order_id }
'checkout.unavailable_items'      // { count }
```

---

## Acceptance Criteria

- [ ] Cart displays all items with current prices (refreshed from Sanity on page open)
- [ ] Changing item quantity updates the total in real-time
- [ ] Removing an item animates out and the total updates
- [ ] Empty cart shows the correct empty state
- [ ] Checkout requires authentication — unauthenticated users are redirected
- [ ] Checkout form validates all required fields before submitting
- [ ] Saved addresses pre-fill the form when selected
- [ ] `POST /api/checkout` fetches prices from Sanity — never uses client-submitted prices
- [ ] `POST /api/checkout` creates the `orders` row BEFORE initiating Flutterwave payment
- [ ] `order_items` rows have the correct server-fetched `unit_price` values
- [ ] Flutterwave webhook verifies signature before any DB writes
- [ ] A successful webhook transitions the order to `confirmed`
- [ ] An invalid/unsigned webhook returns 401 and makes no DB changes
- [ ] A duplicate webhook for an already-confirmed order returns 200 with no changes
- [ ] Processing page polls order status and redirects on confirmation or failure
- [ ] Payment failed page shows a retry option that re-initiates payment without a new order

---

## What This Feature Does NOT Include

- Order tracking / status updates after confirmation — covered in the Order Tracking spec
- Automated thank-you message delivery — the DB trigger creates the record; Resend delivery is in the Thank You spec
- Address book management — covered in the Address Book spec (address selection uses whatever was built there)
- Refunds — not in v1 scope