# Feature: Flash Sales

**Status: Done.** Built in two passes — the pricing/display core shipped during the Gift Museum/Catalog (`13`) pass; this document reflects the gap-closing pass completed 2026-08-19 (see `context/ROADMAP.md`), which closed the remaining gaps (the dedicated page, the navbar strip, the checkout grace period, the checkout price-changed confirmation, timer styling, badge placement) and reconciled this file with shipped reality. Read this as documentation of what's actually running, not aspirational design.

## Overview
Time-limited discounts on catalog products. Configured entirely in Sanity Studio via `salePrice`, `saleStartTime`, and `saleEndTime` fields on the product document. Surfaces across the platform: homepage banner, navbar strip, a dedicated `/flash-sale` page, and on individual product cards and detail pages. Includes a countdown timer (GSAP-animated at ≤60 seconds). Checkout always uses the authoritative server-fetched price, with a 5-minute grace period for a buyer who was already mid-checkout when a sale ends.

---

## Goals
- Drive urgency and conversion with time-limited offers.
- Surface flash sales prominently across all relevant surfaces.
- Ensure the sale price is always correct at checkout — never a stale client-side price.
- Handle the sale-end gracefully (timer hits zero → price updates without a page reload).

---

## Functional Requirements
1. A product is "on flash sale" when `NOW()` is between `saleStartTime` and `saleEndTime` in Sanity, and `salePrice` is set and less than `basePrice`. `isFlashSaleWindowActive` (`lib/flutterwave/getActivePrice.ts`, checkout-authoritative) and `isFlashSaleActive` (`lib/sanity/catalog.ts`, display-only) both implement this check independently — kept separate rather than unified, since the display path also needs to distinguish "was on sale, just ended" (see `useCartPriceRefresh.ts`'s `hasSaleJustEnded`) from "never on sale," which the checkout path doesn't care about.
2. Sale detection and countdown are computed client-side from the `saleEndTime` value fetched with the product.
3. When a sale ends (timer reaches zero): `FlashSaleTimer`'s `onComplete` callback fires, and callers (`ProductDetail`) re-fetch/re-render to show the regular `basePrice`. No page reload.
4. `/flash-sale` page (`app/flash-sale/page.tsx`, `revalidate = 30`): lists all currently active flash sale products via `ProductExplorer` (the same grid/filter/sort/load-more component `/shop` uses) against a new `/api/flash-sale/products` load-more endpoint.
5. `FlashSaleBanner`: homepage hero banner for active sales. Shows when at least one active flash sale product exists; hidden otherwise.
6. `FlashSaleNavbarStrip`: a thin red strip in `Navbar`, below the main header row, shown on both mobile and desktop in the same position (the spec's original "above the mobile bottom nav" placement was skipped — `MobileBottomNav` is a separate fixed-position component, and duplicating layout logic for a single-page divergence wasn't worth it). Fed by a lightweight Sanity fetch added to `PageWrapper.tsx` (the shared server component every public page already routes through) and threaded down through `PublicPageShell` → `Navbar`, the same prop-passing pattern already used for `cartCount`/`userName`. Only shown when an active sale exists.
7. At checkout: `POST /api/checkout` calls `getActivePrice()` server-side (re-fetches Sanity via `CART_PRICES_QUERY`) — this is the price always charged, regardless of what was displayed client-side.
8. **5-minute grace period — redefined from the original spec, developer-confirmed.** The original design ("honor the sale price if `saleEndTime` is within the last 5 minutes AND an order was created before `saleEndTime`") assumes an order can pre-date the price check. In this codebase, order creation and price computation happen in the same `POST /api/checkout` call — there's no earlier "order created" moment to check against, so that condition can never hold. Implemented instead as a pure time-based window: `isWithinGracePeriod` (`lib/flutterwave/getActivePrice.ts`) honors `salePrice` for any checkout priced within 5 minutes after `saleEndTime`, full stop. A client-supplied "checkout started at" timestamp was considered and rejected — it would be spoofable (a malicious client could always send an old timestamp to claim expired pricing), and bounding it safely would collapse back to the same time-window check anyway, with more code. Tradeoff accepted: someone adding the item to cart fresh within that 5-minute window (not just someone already mid-checkout) also gets the discount — a small, bounded, time-boxed leak, not a fraud vector.
9. Flash sale badge on product cards: "Flash sale" pill (bottom-left of product image, per spec — moved from an earlier top-left placement), plus a separate "-X%" discount badge stacked above it when both apply.

---

## Non-Functional Requirements
- Timer updates every second on the client (`FlashSaleTimer`, `setInterval` + `useGSAP`), not a re-render-heavy pattern.
- The `/flash-sale` page uses `revalidate = 30` (shorter than the standard 60s elsewhere).
- Flash sale configuration is entirely in Sanity Studio — no code changes needed to run a sale.

---

## UI Requirements

### `FlashSaleTimer` component (`components/flash-sale/FlashSaleTimer.tsx`)

Props: `endTime: string`, `onComplete?: () => void`, `className?: string`, `disableUrgencyColor?: boolean`.

**Display states** (local `formatFlashSaleCountdown`, separate from the shared `formatCountdown()` in `lib/utils.ts` — that one is also used by `VerifyOtpScreen`'s unrelated OTP countdown and keeps its fixed `HH:MM:SS` shape):
- `>= 1 hour`: `H:MM:SS`
- `< 1 hour, > 60 seconds`: `MM:SS`, amber text (`text-amber-600`)
- `<= 60 seconds`: `MM:SS`, red text (`text-red-600`), continuous GSAP pulse (`scale 1.05`, yoyo, `repeat: -1`) — a different animation curve than an early draft of this spec proposed (one-shot pulse per tick), left as shipped since it already reads as urgent and reworking it wasn't worth the churn.
- `0:00` reached: calls `onComplete()`.

**`disableUrgencyColor`:** the built-in amber/red text coloring is invisible on a brand-red background. Every caller that places the timer inside a `bg-brand` container (`FlashSaleBanner`, `FlashSaleNavbarStrip`, `ProductCard`'s sale badge) passes this prop; `ProductDetail`'s "Sale ends in" strip (on a light `bg-brand-light` background) does not, so its urgency coloring works normally.

### `FlashSaleBanner` component (homepage)
Full-width `bg-brand` banner: "⚡ Flash Sale – Up to X% off · Ends in [timer] · Shop now →", linking to `/flash-sale`. Hidden when no active sale exists. `maxDiscountPercent` is computed via `getMaxFlashSaleDiscountPercent` (`lib/sanity/catalog.ts`) from the fetched sale products.

### `FlashSaleNavbarStrip` component
Single-line strip, same copy pattern as the banner, rendered inside `Navbar`'s `<header>` below the logo/search row.

### `/flash-sale` — Flash sale page
Hero: "⚡ Flash Sale" heading + soonest-ending `FlashSaleTimer` (large format) + "Up to X% off" when computable. Product grid via `ProductExplorer` (2/3/4-col responsive, filter/sort/load-more built in). Empty state: "No flash sales right now. Check back soon!" + a link to `/shop`.

### Product card — flash sale state
`ProductCard` additions when `isOnFlashSale`: "Flash sale" badge (bottom-left, brand-red pill, `z-10` so it stays visible above the card's hover-reveal add-to-cart overlay), stacked with a "-X%" badge when both apply, and `PriceDisplay`'s `isOnFlashSale` prop rendering the price in brand red.

### Product detail page — flash sale state
Already specified in `06-GIFT-MUSEUM-CATALOG.md`/`13-GIFT-MUSEUM-CATALOG.md`. `ProductDetail` shows `FlashSaleTimer` + a "Sale ends in" label between the price section and add-to-cart button, and `PriceDisplay`'s brand-red sale price.

---

## Backend Logic

### `getActivePrice(product, combinationKey, now?)` (`lib/flutterwave/getActivePrice.ts`)
Checkout-authoritative pricing. Returns a plain `number` (not `{ price, isFlashSale }` — a separate `isFlashSaleWindowActive` helper covers the boolean). Handles: no-sale, active sale, the grace period (`isWithinGracePeriod`, see FR #8), variant pricing, and clamps `salePrice` to the base/variant price if a Sanity data-entry error sets `salePrice` higher than the price it's supposed to discount.

### GROQ queries (`lib/sanity/queries.ts`)
`FLASH_SALE_PRODUCTS_QUERY` — active sale products (`status == "active"`, `salePrice > 0`, within the sale window), paginated via `$offset`/`$limit`, ordered `saleEndTime asc`. `FLASH_SALE_PRODUCTS_COUNT_QUERY` shares the same filter for the `/flash-sale` page's total count and `/api/flash-sale/products`'s pagination.

---

## Database Changes
No Supabase tables. Sanity schema (`sanity/schemaTypes/product.ts`): `salePrice` (number, `min(0)` + a custom rule rejecting `salePrice >= basePrice`), `saleStartTime`/`saleEndTime` (datetime, with `saleEndTime`'s own custom rule rejecting an end time before the start time).

---

## API Endpoints
- `GET /api/flash-sale/products` — load-more pagination for `/flash-sale`, mirrors `/api/shop/products` against the flash-sale query. See `API_ROUTES.md`.
- `POST /api/checkout` — unchanged route, extended response. See `API_ROUTES.md` for the full `price_changed`/`price_changes` shape.

---

## Permissions and Authorization
- `/flash-sale` page: public — no auth required.
- Flash sale data in Sanity: read-only for all.

---

## Validation
- Sanity Studio: `salePrice < basePrice`, `saleEndTime` not before `saleStartTime`.
- Runtime guard in `getActivePrice`: clamps a misconfigured `salePrice >= basePrice` down to the correct price rather than showing an inflated "sale."

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Product `salePrice >= basePrice` (misconfiguration) | Blocked at the Sanity Studio level; `getActivePrice` also clamps defensively if one slips through |
| Sale ends mid-checkout | `getActivePrice`'s grace period covers the first 5 minutes; past that, `POST /api/checkout` still creates the order at the correct price and reports `price_changed: true` so `CheckoutForm.tsx` can show `PriceChangeDialog` before redirecting to payment |
| No active flash sales | `/flash-sale` shows the empty state; banner/navbar strip hidden |

---

## Edge Cases

1. **Sale starts while a user is on the product detail page.** ISR-driven (`revalidate = 60` on `/product/[slug]`); the sale price appears on the next revalidation. Acceptable, unchanged from the original design.
2. **Sale ends exactly when a user is at the checkout payment step.** `POST /api/checkout` compares its server-computed `unitPrice` against the client's submitted `display_price`; on a mismatch it still creates the order at the correct price and returns `price_changed: true` + a `price_changes` list. `CheckoutForm.tsx` shows `PriceChangeDialog` (a blocking confirmation, "Continue to pay") before redirecting to the Flutterwave payment link, instead of silently redirecting at a different price than what the buyer last saw.
3. **Multiple simultaneous flash sales.** The navbar strip and banner show the soonest-ending (via `FLASH_SALE_PRODUCTS_QUERY`'s `order(saleEndTime asc)`) and the max discount percent across the fetched set. `/flash-sale` shows all.
4. **`FlashSaleTimer` renders on the server and re-hydrates on the client.** Handled by lazy-initializing state from `Date.now()` on mount rather than an explicit `suppressHydrationWarning`.
5. **Product added to a wishlist during a flash sale.** Unchanged from the original design: the wishlist item stores a price snapshot for display; checkout always re-fetches the live price regardless.

---

## Analytics / Events
Uses this repo's established `museum.*`/domain-prefixed event naming rather than the `flash_sale.*` prefix an earlier draft of this spec used — consistent with every other catalog-adjacent feature (`museum.search.*`, `museum.shop.*`, etc.):
- `museum.flash_sale_banner.clicked`
- `museum.flash_sale_strip.clicked`
- `museum.flash_sale.page_viewed` (`active_product_count`)
- `flash_sale.price_changed_at_checkout` (`order_id`, `changed_item_count`) — kept under the original prefix since it's checkout-domain, not museum-browsing-domain.

---

## Testing Requirements
- `lib/flutterwave/getActivePrice.test.ts`: no-sale, active sale, expired sale, variant pricing, `salePrice` clamping, within-grace-period, past-grace-period.
- `app/api/checkout/route.test.ts`: `price_changed`/`price_changes` returned when the server price differs from the submitted `display_price`.

### Manual QA
- Add a flash sale to a product in Sanity Studio. Verify sale price + badge/timer appear on the product card, detail page, banner, and navbar strip.
- Let the timer count down through the 1hr/60s format-and-color thresholds; verify the GSAP pulse at ≤60s.
- Let a sale expire mid-checkout; verify `PriceChangeDialog` appears before payment redirect, and that the order was created at the correct (new) price.

---

## Acceptance Criteria
- [x] Flash sale fields (`salePrice`, `saleStartTime`, `saleEndTime`) exist on the Sanity product schema with correct validation.
- [x] Flash sale badge and sale price appear on product cards and detail pages when a sale is active.
- [x] `FlashSaleTimer` counts down correctly and switches to brand red + GSAP pulse at ≤60 seconds.
- [x] When the timer hits zero, the regular price is shown without a page reload.
- [x] The `/flash-sale` page shows only currently active sale products.
- [x] `getActivePrice()` always returns the correct price server-side (sale, grace period, or regular).
- [x] A product configured with `salePrice >= basePrice` does not show a flash sale.

---

## Future Improvements
- Per-variant flash sale pricing (different variants at different sale prices).
- Waitlist / notification for upcoming (scheduled but not yet active) flash sales.
- Flash sale analytics dashboard in Retool showing conversion uplift.
