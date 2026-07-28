# Feature: Flash Sales

## Overview
Time-limited discounts on catalog products. Configured entirely in Sanity Studio via `salePrice`, `saleStartTime`, and `saleEndTime` fields on the product document. Surfaces across the platform: homepage banner, navbar strip, a dedicated `/flash-sale` page, and on individual product cards and detail pages. Includes a countdown timer (GSAP-animated at ≤60 seconds). Checkout always uses the authoritative server-fetched price with a 5-minute grace period for users actively checking out when a sale ends.

---

## Goals
- Drive urgency and conversion with time-limited offers.
- Surface flash sales prominently across all relevant surfaces.
- Ensure the sale price is always correct at checkout — never a stale client-side price.
- Handle the sale-end gracefully (timer hits zero → price updates without a page reload).

---

## User Stories
- As a shopper, I see a flash sale banner on the homepage and in the navbar so I don't miss it.
- As a shopper, I can browse all current flash sale products on a dedicated page.
- As a shopper, I see a countdown timer on a product card and detail page while a sale is active.
- As a shopper, when the timer hits zero the sale price updates immediately (no page reload required).
- As a shopper, if I'm mid-checkout when a sale ends, the correct price at checkout time is charged.

---

## Functional Requirements
1. A product is "on flash sale" when `NOW()` is between `saleStartTime` and `saleEndTime` in Sanity, and `salePrice` is set and less than `basePrice`.
2. Sale detection and countdown are computed client-side from the `saleEndTime` value fetched with the product.
3. When a sale ends (timer reaches zero): re-fetch the product from Sanity, display the regular `basePrice`. No page reload — the `FlashSaleTimer` component drives a state update on expiry.
4. `/flash-sale` page: lists all currently active flash sale products.
5. `FlashSaleBanner`: homepage hero banner for active sales. Shows when at least one active flash sale product exists; hidden otherwise.
6. `FlashSaleNavbarStrip`: a thin red strip below the main navbar (desktop) or above the bottom nav (mobile), e.g. "⚡ Flash Sale – Up to 40% off · Ends in 2:34:11". Only shown when a sale is active.
7. At checkout: `POST /api/checkout` calls `getActivePrice()` server-side (re-fetches Sanity) — this is the price always charged, regardless of what was displayed client-side.
8. 5-minute grace period: if a sale ended within the last 5 minutes and the user has an active `pending_payment` order (created before the sale ended), honor the sale price. **This grace period is implemented in `getActivePrice()` on the server — check if `saleEndTime` is within the last 5 minutes AND an order was created before `saleEndTime`.**
9. Flash sale badge on product cards: "SALE" or "X% off" badge (bottom-left of product image).

---

## Non-Functional Requirements
- Timer updates every second on the client without causing performance issues — use `setInterval` inside `useGSAP` or a dedicated timer hook, not a re-render-heavy pattern.
- The `/flash-sale` page uses `revalidate = 30` (shorter than the standard 60s) to keep the product list fresh.
- Flash sale configuration is entirely in Sanity Studio — no code changes needed to run a sale.

---

## UI Requirements

### `FlashSaleTimer` component

Props: `endTime: Date`, `onExpire: () => void`

**Display states:**
- `>= 1 hour`: "Ends in 2:34:11" (HH:MM:SS)
- `< 1 hour and > 60 seconds`: "Ends in 34:11" (MM:SS), amber text
- `<= 60 seconds`: "Ends in 0:47" (red text, GSAP pulse animation on each tick)
- `0:00 reached`: calls `onExpire()` → parent re-fetches product and hides timer

**GSAP pulse at ≤60 seconds:**
```javascript
useGSAP(() => {
  if (seconds <= 60) {
    gsap.fromTo(timerRef.current,
      { scale: 1 },
      { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1, ease: 'power1.inOut' }
    )
  }
}, { dependencies: [seconds] })
```

### `FlashSaleBanner` component (homepage)

Full-width banner (brand red background):
- Left: "⚡ Flash Sale" + "Up to X% off · Ends in [timer]"
- Right: "Shop now →" CTA linking to `/flash-sale`
- Hidden when no active sale products exist.

### `FlashSaleNavbarStrip` component

Single-line strip: brand red bg, white text. "⚡ Flash Sale – Up to 40% off · Ends in 2:34:11 · [Shop now]". Shown in `Navbar` component when an active sale exists. Hidden when sale ends.

### `/flash-sale` — Flash sale page

**Hero section:**
- "⚡ Flash Sale" heading
- "Offers end in [FlashSaleTimer]" (driven by the soonest-ending active sale)
- Countdown in large format

**Product grid:**
- 2 col mobile, 3–4 desktop
- Each card uses `ProductCard` with the sale badge variant
- "SALE" badge + "X% off" chip on each card
- Sale price (brand red) + original price (strikethrough)

**Empty state** (no active flash sales): "No flash sales right now. Check back soon!" + CTA to browse the regular catalog.

### Product card — flash sale state

`ProductCard` additions when `isOnFlashSale`:
- Sale badge overlay: bottom-left corner, "SALE" pill (brand red bg, white text)
- Sale price displayed in brand red, original price struck through alongside it

### Product detail page — flash sale state

Already specified in `06-GIFT-MUSEUM-CATALOG.md`. Additions:
- `FlashSaleTimer` between price section and add-to-cart button
- "🔥 Flash sale price" label above the sale price

---

## Backend Logic

### `getActivePrice(product, orderCreatedAt?)` with grace period
```typescript
// lib/sanity/pricing.ts
export function getActivePrice(
  product: SanityProduct,
  orderCreatedAt?: Date
): { price: number, isFlashSale: boolean } {
  const now = new Date()
  const saleStart = product.saleStartTime ? new Date(product.saleStartTime) : null
  const saleEnd = product.saleEndTime ? new Date(product.saleEndTime) : null
  
  // Standard flash sale check
  const saleActive = saleStart && saleEnd && saleStart <= now && saleEnd > now
  
  // Grace period: sale ended within last 5 minutes AND order was created before sale ended
  const graceActive = saleStart && saleEnd
    && saleEnd <= now
    && (now.getTime() - saleEnd.getTime()) <= 5 * 60 * 1000
    && orderCreatedAt
    && orderCreatedAt < saleEnd
  
  if ((saleActive || graceActive) && product.salePrice && product.salePrice < product.basePrice) {
    return { price: product.salePrice, isFlashSale: true }
  }
  
  // Variant pricing (cheapest available)
  if (product.hasVariants && product.variants?.length) {
    const prices = product.variants.filter(v => v.available).map(v => v.price)
    if (prices.length) return { price: Math.min(...prices), isFlashSale: false }
  }
  
  return { price: product.basePrice, isFlashSale: false }
}
```

### GROQ query for active flash sale products
```groq
*[_type == "product"
  && defined(salePrice)
  && defined(saleStartTime)
  && defined(saleEndTime)
  && saleStartTime <= now()
  && saleEndTime > now()
  && salePrice < basePrice
] {
  _id, title, slug, basePrice, salePrice, saleStartTime, saleEndTime,
  "primaryImage": images[0], hasVariants,
  "variants": variants[]{ price, available }
} | order(saleEndTime asc)
```

### Check if any active flash sale exists (for navbar strip / banner visibility)
```typescript
// Runs on layout level — cached with short revalidation
const hasActiveFlashSale = await sanity.fetch(`
  count(*[_type == "product" && saleStartTime <= now() && saleEndTime > now()]) > 0
`)
```

---

## Database Changes
No new Supabase tables. Sanity schema changes required:

**Add to `product.ts` Sanity schema** (if not already added during Gift Museum feature build):
```typescript
defineField({ name: 'salePrice', title: 'Sale Price (₦)', type: 'number',
  description: 'Must be less than the regular price.',
  validation: Rule => Rule.min(0)
}),
defineField({ name: 'saleStartTime', title: 'Sale Start Time', type: 'datetime' }),
defineField({ name: 'saleEndTime', title: 'Sale End Time', type: 'datetime',
  validation: Rule => Rule.min(Rule.valueOfField('saleStartTime'))
}),
```

**Sanity Studio validation rule** (prevent `salePrice >= basePrice`):
```typescript
// In product.ts schema:
validation: Rule => Rule.custom((salePrice, context) => {
  const { basePrice } = context.document as any
  if (salePrice && basePrice && salePrice >= basePrice) {
    return 'Sale price must be less than the regular price'
  }
  return true
})
```

---

## API Endpoints
No new API routes specific to flash sales. The `/flash-sale` page is a server component fetching from Sanity. The `FlashSaleTimer` expiry re-fetches Sanity client-side via a client component using the Sanity client.

---

## Permissions and Authorization
- `/flash-sale` page: public — no auth required.
- Flash sale data in Sanity: read-only for all.

---

## Validation
- Sanity Studio validation: `salePrice < basePrice`, `saleEndTime > saleStartTime`.
- Runtime guard in `getActivePrice`: `salePrice < basePrice` check prevents misconfigured sales showing a higher "sale" price.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Product `salePrice >= basePrice` (misconfiguration) | `getActivePrice` returns `basePrice`, no flash sale shown |
| Timer hits zero, re-fetch fails | Show regular price from last cached data; hide timer; log error |
| No active flash sales | `/flash-sale` shows empty state; banner/navbar strip hidden |

---

## Loading and Empty States

- **`/flash-sale` page loading:** skeleton hero + skeleton product grid.
- **No active sales:** "No flash sales right now. Check back soon!" + regular catalog CTA.
- **Timer between server render and client hydration:** a non-interactive static countdown display from the server render, replaced by the live client timer on hydration. Use `suppressHydrationWarning` on the timer element to prevent React hydration mismatch on the seconds digit.

---

## Edge Cases

1. **Sale starts while a user is on the product detail page.** The page is server-rendered with ISR (60s revalidation). The sale price won't appear until the next ISR refresh. For the flash sale banner: it's a client component that re-checks on mount — it should appear within 60 seconds of the sale starting. Acceptable.

2. **Sale ends exactly when a user is at the checkout payment step.** The `POST /api/checkout` server call happens after the sale ends → `getActivePrice` returns the regular price → user is charged the regular price. The checkout page should ideally show a "Heads up — this sale just ended" message if the server-returned price differs from what the user saw. Implement: return `price_changed: true` from `POST /api/checkout` if any item's server price differs from the client-sent price, and show a confirmation dialog before redirecting to Flutterwave.

3. **Multiple simultaneous flash sales.** The navbar strip should show the one ending soonest (for maximum urgency). The `/flash-sale` page shows all. The homepage banner shows the most prominent (highest discount % or editorial pick — leave this to content team configuration in Sanity by ordering documents).

4. **`FlashSaleTimer` renders on the server (SSR) and then re-hydrates on the client.** The seconds digit will differ between server render and client — use `suppressHydrationWarning` on the timer's seconds span, or render the timer client-only (`"use client"` with a `mounted` state check).

5. **Product added to a wishlist during a flash sale.** The `wishlist_items` row stores a price snapshot. When the sale ends, the wishlist card still shows the (now stale) sale price. For catalog items, wishlist item cards should re-fetch the current Sanity price on display rather than relying on the snapshot — or show the snapshot with a "price may have changed" note. **v1 recommendation: use the snapshot for display, re-fetch at purchase time (checkout). The price discrepancy is a known UX issue, not a financial risk.**

---

## Analytics / Events
- `flash_sale.banner_viewed`
- `flash_sale.navbar_strip_viewed`
- `flash_sale.page_viewed` (active_product_count)
- `flash_sale.product_card_clicked` (product_id)
- `flash_sale.timer_expired` (product_id — tracks how many users see a sale end in real-time)
- `flash_sale.price_changed_at_checkout` (product_id — tracks the grace period edge case frequency)

---

## Testing Requirements

### Unit tests
- `getActivePrice`: all cases — no sale, sale active, sale expired, within 5-min grace period, sale price >= base price (guard).
- Timer countdown logic: correct formatting for >1hr, <1hr, ≤60s.

### Integration tests
- GROQ flash sale query: returns only products where `now()` is within `saleStartTime–saleEndTime`.
- `POST /api/checkout` uses server-fetched sale price, not client-sent price.
- Grace period: order created before `saleEndTime`, checkout POST runs 3 minutes after `saleEndTime` → sale price honored.
- No grace period: order created before `saleEndTime`, checkout POST runs 6 minutes after `saleEndTime` → regular price charged.

### Manual QA
- Add a flash sale to a product in Sanity Studio. Wait up to 60 seconds. Verify sale price + timer appear on the product detail page and in the product card.
- Let the timer count down to zero (or set a short `saleEndTime`). Verify the regular price is shown without a page reload.
- Start a checkout during a sale, let the sale expire, submit the checkout — verify correct price is charged.

---

## Acceptance Criteria
- [ ] Flash sale fields (`salePrice`, `saleStartTime`, `saleEndTime`) exist on the Sanity product schema with correct validation.
- [ ] Flash sale badge and sale price appear on product cards and detail pages when a sale is active.
- [ ] `FlashSaleTimer` counts down correctly and switches to brand red + GSAP pulse at ≤60 seconds.
- [ ] When the timer hits zero, the regular price is shown immediately without a page reload.
- [ ] The `/flash-sale` page shows only currently active sale products.
- [ ] `getActivePrice()` always returns the correct price server-side (sale, grace period, or regular).
- [ ] A product configured with `salePrice >= basePrice` does not show a flash sale.

---

## Future Improvements
- Per-variant flash sale pricing (different variants at different sale prices).
- Flash sale scheduling via Sanity — set it and forget it.
- Waitlist / notification for upcoming (scheduled but not yet active) flash sales.
- Flash sale analytics dashboard in Retool showing conversion uplift.
