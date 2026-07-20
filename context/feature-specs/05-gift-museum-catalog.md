# Feature Spec: Gift Museum & Catalog

**Project:** Gifvtme
**Module:** 06 — Gift Museum & Catalog
**Priority:** Core
**Depends on:** Auth flow complete. Sanity CMS set up with schema deployed. Sanity Studio has at least one occasion, one collection, and one product created for testing.
**Agent instruction:** Implement both UI and backend logic together. Apply `RESPONSIVE_DESIGN_DIRECTIVE.md` for desktop adaptation. Mobile screenshots are the design source of truth. Make reasonable decisions where unspecified and note them in comments. Do not ask for clarification.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components by default)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Icons:** lucide-react
- **Forms:** react-hook-form + Zod (for filters)
- **Animation:** GSAP + @gsap/react
- **CMS:** Sanity (GROQ queries already written in `lib/sanity/queries.ts`)
- **Database:** Supabase (for wishlist interactions, reviews aggregate)
- **Path alias:** `@/` maps to `src/`

---

## Overview

The gift museum is the editorial discovery layer of Gifvtme — the "museum" experience that makes it more than a standard e-commerce shop. It is organized as: **Occasion → Collections → Products**.

A shopper lands on an occasion page (e.g. "Birthday Gifts"), browses editorial collections ("For your best friend", "Under ₦5,000", "Luxury treats"), and finds individual products to buy or add to their wishlist.

This feature covers:
- Home page integration (occasions grid, featured products, flash sale banner)
- All occasions page (`/occasions`)
- Single occasion page (`/occasions/[slug]`)
- Collection page (`/collections/[slug]`)
- Product detail page (`/product/[slug]`)
- Product search (`/search`)
- Shop page (`/shop`) — flat product grid with filters
- "Add to wishlist" action from any product surface
- "Add to cart" action (adds to client-side cart state)

All catalog data comes from Sanity CMS. Sanity client and GROQ queries are already set up in `lib/sanity/`.

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Home page update | `/` | Add occasion grid, featured products, flash sale banner |
| All occasions | `/occasions` | Grid of all active occasions |
| Occasion detail | `/occasions/[slug]` | Hero + collections grid |
| Collection detail | `/collections/[slug]` | Products with pagination and filters |
| Product detail | `/product/[slug]` | Full product page with variants, reviews, CTAs |
| Shop (all products) | `/shop` | Flat grid with filters, search link |
| Search results | `/search` | Results from GROQ match query |

---

## Detailed Screen Requirements

### Home Page Updates (`/`)

The home page already exists. This feature adds the missing data-driven sections.

**Section 1 — Flash sale banner (if active sales exist):**
- Full-width banner below the navbar
- Red background, lightning bolt icon
- "⚡ Flash Sale — ends in HH:MM:SS" with a live countdown
- "Shop now →" link to `/flash-sale`
- Only shown when at least one product has an active sale window
- If no active sales: section hidden entirely (no empty state)

**Section 2 — Occasions grid:**
- Section header: "Shop by occasion"
- Grid: 2 columns mobile, 3 tablet, 6 desktop (small icon cards)
- Each card: occasion cover image (or colored background + emoji), occasion title, item count
- "Shop all occasions →" link below the grid → `/occasions`
- Data: from `OCCASIONS_QUERY` (already in `lib/sanity/queries.ts`)

**Section 3 — Recommended / Featured products:**
- Section header: "Featured gifts"
- Filter pills: "Best Seller" | "On sale" | "New Arrivals" | "Top Rated"
  - "Best Seller": default — featured products from Sanity (`featured=true`)
  - "On sale": products currently within a flash sale window
  - "New Arrivals": products sorted by `_createdAt DESC`
  - "Top Rated": products with highest average rating (requires a Supabase join — for v1, skip this tab or show featured products as fallback)
- Product grid: 2 columns mobile, 4 desktop
- "Show more →" link below → `/shop`
- Data: from `FEATURED_PRODUCTS_QUERY` with `limit: 8`

**Section 4 — Trust badges:**
- Four icons in a row (or 2×2 grid on mobile):
  - 🚚 "Affordable Delivery"
  - 🛡️ "Return Warranty"
  - 📞 "24/7 Support"
  - 🎁 "Member Gifts"

**Section 5 — Newsletter / discount CTA:**
- "Be the first to know about our discount orders"
- Email input + "Search" / "Subscribe" button
- For v1: collect email in a Supabase `newsletter_subscribers` table (simple: id, email, created_at)
- No email sending required for v1 — just store the address

---

### All Occasions Page (`/occasions`)

**Route:** `/occasions`
**Rendering:** Server component, `revalidate = 60`

**Layout:**
- Page title: "Gift Museum" or "Shop by Occasion"
- Grid of occasion cards: 2 columns mobile, 3 tablet, 3 desktop (larger cards than homepage)
- Each card:
  - Cover image (full bleed, aspect ratio 4:3)
  - Occasion type emoji overlay (top left, on the image)
  - Occasion title (below image, bold)
  - Item count or collection count ("6 collections")
  - "Shop now →" link

**Data:** `OCCASIONS_QUERY` from `lib/sanity/queries.ts`

**Empty state:** "No occasions available yet — check back soon."

---

### Occasion Detail Page (`/occasions/[slug]`)

**Route:** `/occasions/[slug]`
**Rendering:** Server component, `revalidate = 60`

**Layout:**

**Hero section:**
- Full-bleed cover image (40vh height mobile, 50vh desktop)
- Occasion emoji (large, 48px) overlaid on image
- Occasion title (large, white, overlaid on image with dark gradient)
- Short description (white text, below title)

**Collections grid (below hero):**
- Section header: "Browse collections"
- Grid: 1 column mobile, 2 tablet, 3 desktop
- Each collection card:
  - Cover image (aspect ratio 3:2, `rounded-2xl`)
  - Collection title (bold, below image)
  - Short description (2 lines max, muted)
  - Item count: "23 items"
  - "Featured" badge (brand red) if `collection.featured=true`
  - Entire card is tappable → `/collections/[collection.slug]`

**GSAP animation:**
- Collection cards stagger in: `gsap.from(cards, { opacity: 0, y: 30, stagger: 0.1, duration: 0.4, ease: 'power2.out' })` on scroll into view (use IntersectionObserver to trigger)

**Data:** `OCCASION_PAGE_QUERY` from `lib/sanity/queries.ts`

**Error/empty states:**
- Invalid slug → `notFound()` → 404
- Occasion inactive → `notFound()` → 404
- No collections yet → "Collections coming soon for this occasion."

---

### Collection Detail Page (`/collections/[slug]`)

**Route:** `/collections/[slug]`
**Rendering:** Server component for initial load, client for pagination

**Layout:**

**Breadcrumb (desktop only):**
`Home → Occasions → [Occasion Name] → [Collection Name]`

**Collection header:**
- Collection title (H1)
- Short description (muted, 2 lines)
- Item count: "Showing 1–12 of 32 results"

**Toolbar:**
- Filter icon + "Filter" text button (opens filter sheet on mobile, shows inline on desktop)
- Grid/list view toggle (grid icon + list icon) — grid is default
- "Show" dropdown: 16 / 32 / 48 items per page
- "Sort by" dropdown: Default | Price: Low to High | Price: High to Low | Newest

**Product grid:**
- 2 columns mobile, 3 tablet, 4 desktop
- Uses `ProductCard` component (already built)
- Pagination: "Load more" button at bottom — appends next page to existing items

**Filter sheet/sidebar:**
- Mobile: slides up as a bottom sheet
- Desktop: inline sidebar (240px, left of the product grid)
- Price range: min/max number inputs (₦)
- Occasion type: checkboxes (Birthday, Wedding, etc.)
- "Apply filters" button (brand red) / "Clear all" link
- Filters are applied client-side on the current fetched dataset for v1

**Data:** `COLLECTION_PAGE_QUERY` from `lib/sanity/queries.ts` with `$offset` and `$limit` params

**Load more implementation:**
```typescript
// Start with 12 items
// Each "Load more" click fetches 12 more
// Append to existing array
// Hide "Load more" when totalProducts === loadedCount
```

---

### Product Detail Page (`/product/[slug]`)

**Route:** `/product/[slug]`
**Rendering:** Server component for data, client components for interactivity
**SEO:** Include JSON-LD structured data (Product schema)

**Layout (mobile: stacked, desktop: two-column side by side):**

**Left column / top section — Image gallery:**
- Primary image: full width on mobile, fixed width on desktop
- Thumbnail strip below (or vertical rail on desktop): up to 5 thumbnails
- Tapping a thumbnail swaps the primary image
- Badges overlaid on primary image:
  - "⚡ Flash sale" (brand red, top left) — if currently on sale
  - "-30%" discount badge (brand red circle, top left) — calculated from sale savings
  - "New" badge (dark, top right) — if product created within last 14 days

**Right column / bottom section — Product info:**

Product title (H1)
Price display:
- If on flash sale: sale price (large, brand red) + original price (smaller, struck through, muted)
- If not on sale: regular price (large, black)
- "Price not listed" if no price set

Flash sale timer (if on sale):
- "Sale ends in HH:MM:SS" — uses `FlashSaleTimer` component
- When timer hits 0: re-fetch price from Sanity, update display

Star rating summary:
- "4.5 ★ (52 reviews)" — links to reviews section (smooth scroll)
- If no reviews: "No reviews yet"

Variant selector (if `hasVariants=true`):
- One attribute group per `product.attributes` entry
- Attribute label: "Size" or "Color" etc.
- Options as tappable pills: selected = brand-red border + brand-light background
- Sold-out variant option: grey, strikethrough, non-tappable
- When all required attributes selected: resolve `combinationKey` and find the matching `product.variants` entry
- If combination not found: "Unavailable in this combination" — disable CTAs

Quantity stepper:
- Uses `QuantityStepper` component (already built)
- Min: 1, Max: 99

Shipping estimate:
- "Estimated delivery: 5–10 days" from `product.estimatedDeliveryDays`

SKU / Category / Tags:
- Small muted text rows below CTAs

Group payment checkbox (display only):
- Checkbox (pre-checked) + "Allow group payment — This allows multiple people to contribute to this wish"
- This is a UI placeholder — not functional in v1

Primary CTA:
- "Add to cart" (brand red, pill, full width) — adds to client-side cart state
- For authenticated receivers: "Add to wishlist" (ghost, pill, full width) below

Secondary info links (matching Figma design):
- "Ask a Question" (with question mark icon)
- "Size Guide" (with shirt icon) — stub modal
- "Delivery Return" (with truck icon) — links to the shipping info page

**Below the fold — Tabs:**
- "Description" tab (default active)
- "Reviews ([count])" tab

**Description tab:**
- Renders Sanity Portable Text (use `@portabletext/react`)
- Inline images supported

**Reviews tab:**
- Rating breakdown chart (1–5 stars with horizontal bars showing percentage)
- Overall score (large number, e.g. "4.0") + star visual + "52 Reviews"
- Individual review cards (avatar, name, rating, date, body)
- "Read More Reviews" / Load more (10 per page)
- "Leave a review" button — only shown for authenticated users who have a delivered order with this product

**Featured products section (below tabs):**
- Section header: "You might also like"
- 4 product cards from the same collection or occasion type

**JSON-LD structured data:**
```typescript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.title,
  description: product.shortDescription,
  image: product.images?.[0]?.url,
  offers: {
    '@type': 'Offer',
    price: displayPrice,
    priceCurrency: 'NGN',
    availability: isAvailable
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock'
  },
  aggregateRating: reviewCount > 0 ? {
    '@type': 'AggregateRating',
    ratingValue: avgRating,
    reviewCount
  } : undefined
}
```

---

### Shop Page (`/shop`)

**Route:** `/shop`
**Rendering:** Server component for initial load

**Layout:**
- Utility bar at top: flash sale announcement link if active
- Toolbar: filter, sort, results count
- Product grid: same as collection page
- Sidebar filters: same filter options as collection page

**Data:** All active products from Sanity, paginated

**GROQ query needed (add to `lib/sanity/queries.ts`):**
```groq
*[_type == "product" && status == "active"]
| order(featured desc, _createdAt desc)
[$offset...$offset + $limit] {
  // PRODUCT_CARD_FRAGMENT
}
```

---

### Search Results Page (`/search`)

**Route:** `/search?q=[query]`
**Rendering:** Server component

**Behavior:**
- Empty query (`q=''` or missing) → redirect to `/shop`
- Non-empty query → fetch from `PRODUCT_SEARCH_QUERY`
- Maximum 48 results, no pagination in v1

**Layout:**
- Header: `Results for "[query]"` + result count
- Same `ProductGrid` as everywhere else
- Sort toolbar (client-side sort on fetched results)

**Empty state:**
- "No products found for '[query]'"
- Three featured occasion cards as browse suggestions
- "Browse all gifts" → `/shop`

**Navbar search wiring:**
- The `Navbar` search input already exists but does nothing
- Wrap it in `<form action="/search" method="GET">` with input `name="q"`
- On the `/search` page, pre-fill the navbar input with the current query

---

## Add to Wishlist Flow (from any product surface)

When a user taps "Add to wishlist" on a catalog product:

**If not authenticated:**
- Show `AuthGateSheet` (built in the sharing feature): "You need an account to add to your wishlist"

**If authenticated, one wishlist (evergreen only):**
- Add directly to evergreen wishlist, show success toast: "Added to your wishlist ✓"

**If authenticated, multiple wishlists (evergreen + occasions):**
- Show a small bottom sheet / popover: "Add to which wishlist?"
- List: "My Wishlist" (evergreen) + each active occasion
- Tap one → add to that wishlist, dismiss sheet, show toast

**Adding to wishlist (catalog item):**
Creates a `wishlist_items` row with:
- `origin='catalog'`
- `catalog_product_id` = Sanity product `_id`
- `title` = product title (snapshot)
- `image_url` = first image URL (snapshot)
- `price` = current display price (snapshot)
- `is_exclusive=false`

Also creates a `master_items` row if the target wishlist is `type='evergreen'`.

**API endpoint:** `POST /api/wishlists/[id]/items` (already built — handles `origin='catalog'`)

---

## Cart State (Client-Side)

The cart is client-side only in v1 (not persisted to Supabase). Use React Context or Zustand.

**Cart item shape:**
```typescript
interface CartItem {
  catalog_product_id: string
  product_title: string
  product_image_url: string | null
  combination_key: string | null
  selected_options: Record<string, string>
  quantity: number
  unit_price: number
  supplier_product_id: string | null
}
```

**Cart context provides:**
- `items: CartItem[]`
- `addItem(item: CartItem): void`
- `removeItem(catalog_product_id: string, combination_key: string | null): void`
- `updateQuantity(catalog_product_id: string, combination_key: string | null, quantity: number): void`
- `clearCart(): void`
- `totalItems: number`
- `totalPrice: number`

**Cart count in Navbar:**
The `Navbar` component already accepts a `cartCount` prop. Wire the cart context's `totalItems` into it.

**"Add to cart" behavior:**
- If same product + same variant already in cart → increment quantity
- If same product + different variant → add as separate line item
- Show a brief success animation: the cart icon in the navbar "bounces" (GSAP)

---

## Backend Requirements

### Newsletter subscription

**`POST /api/newsletter`**

```typescript
const NewsletterSchema = z.object({
  email: z.string().email('Enter a valid email address')
})

// Insert into newsletter_subscribers table
await supabase.from('newsletter_subscribers').insert({ email: body.email })
// Return 201, or 409 if email already subscribed
```

### Add to wishlist (catalog item)

Handled by the existing `POST /api/wishlists/[id]/items` — no new route needed. The `origin='catalog'` path already handles creating `wishlist_items` and `master_items` rows.

### Reviews aggregate (for product detail page)

```typescript
// Fetch from Supabase on the server component
const { data: reviews } = await supabase
  .from('reviews')
  .select('rating')
  .eq('catalog_product_id', product._id)

const count = reviews?.length ?? 0
const avg = count > 0
  ? reviews!.reduce((sum, r) => sum + r.rating, 0) / count
  : 0

const breakdown = [5, 4, 3, 2, 1].map(star => ({
  star,
  count: reviews?.filter(r => r.rating === star).length ?? 0,
  pct: count > 0
    ? Math.round((reviews?.filter(r => r.rating === star).length ?? 0) / count * 100)
    : 0
}))
```

---

## Database Changes

### New table: `newsletter_subscribers`

```sql
-- Add to gifvtme_migration_003.sql or a new migration 004
CREATE TABLE public.newsletter_subscribers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No RLS needed — insert only, no user-specific data
```

### Sanity schema additions (already specified in the Sanity schema files)

The following fields must exist on the Sanity `product` document for flash sales. If not already added, add them now:

```typescript
// In sanity/schemaTypes/product.ts
defineField({ name: 'salePrice', title: 'Flash sale price (₦)', type: 'number', group: 'variants' }),
defineField({ name: 'saleStartTime', title: 'Sale start time', type: 'datetime', group: 'variants' }),
defineField({ name: 'saleEndTime', title: 'Sale end time', type: 'datetime', group: 'variants' }),
```

Update `PRODUCT_CARD_FRAGMENT` and `PRODUCT_FULL_FRAGMENT` in `lib/sanity/queries.ts` to include these fields.

### New GROQ queries to add to `lib/sanity/queries.ts`

```groq
// All active products (for /shop)
SHOP_PRODUCTS_QUERY

// Flash sale products (for the banner and /flash-sale page)
FLASH_SALE_PRODUCTS_QUERY

// Products related to a given occasion type (for "you might also like")
RELATED_PRODUCTS_QUERY
```

---

## File Structure

```
src/
  app/
    page.tsx                          ← Update with occasion grid, featured products
    occasions/
      page.tsx                        ← All occasions grid
      [slug]/
        page.tsx                      ← Occasion detail with collections
    collections/
      [slug]/
        page.tsx                      ← Collection detail with product grid + filters
    product/
      [slug]/
        page.tsx                      ← Product detail page
    shop/
      page.tsx                        ← All products with filters
    search/
      page.tsx                        ← Search results
    api/
      newsletter/
        route.ts                      ← POST subscribe
  components/
    product/
      ProductCard.tsx                 ← Already built — extend for flash sale badge
      ProductGrid.tsx                 ← Already built — use as-is
      ProductDetail.tsx               ← New — client component for interactivity
      ProductImageGallery.tsx         ← New — image + thumbnails
      VariantSelector.tsx             ← New — attribute/option selection
      RatingBreakdown.tsx             ← New — 5-bar rating chart
      RelatedProducts.tsx             ← New — "you might also like" section
    flash-sale/
      FlashSaleBanner.tsx             ← New — top-of-page sale banner
      FlashSaleTimer.tsx              ← New — countdown HH:MM:SS
    cart/
      CartContext.tsx                 ← New — React context for cart state
      CartProvider.tsx                ← New — wrap app in this
    collection/
      CollectionCard.tsx              ← New — card on occasion page
      FilterSheet.tsx                 ← New — filter bottom sheet/sidebar
      SortDropdown.tsx                ← New — sort options
    occasion/
      OccasionCard.tsx                ← Already built for dashboard — extend for museum
    shared/
      WishlistPickerSheet.tsx         ← New — "add to which wishlist" picker
```

---

## Design System Reference

Same tokens as all previous specs. Additional notes for this feature:

**Product card hover state (desktop):**
```tsx
// On hover, show "Add to cart" and "Add to wishlist" buttons overlaid on the image
// Use Tailwind group-hover classes
<div className="group relative">
  <img ... />
  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/40">
    <Button size="sm" className="w-full">Add to cart</Button>
  </div>
</div>
```

**Rating stars:**
- Filled star color: `#F59E0B` (amber/gold)
- Empty star color: `#D1D5DB` (grey)
- Use the `Star` icon from lucide-react, fill it with CSS

**Flash sale badge:**
- Background: `#C50404`
- Text: white
- Content: "⚡ Flash sale"
- Position: absolute, top-left of product image

---

## GSAP Animations

| Element | Animation |
|---|---|
| Occasion cards entrance | Stagger fade-up on scroll into view |
| Collection cards entrance | Stagger fade-up on scroll into view |
| Product grid entrance | Stagger fade-up, 0.05s between each card |
| Product image swap (thumbnail click) | `gsap.to(primaryImage, { opacity: 0, duration: 0.15 })` then swap src then fade in |
| "Add to cart" success | Cart icon in navbar: `gsap.to(cartIcon, { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1 })` |
| "Add to wishlist" success | Heart icon: `gsap.to(heart, { scale: 1.4, duration: 0.15, yoyo: true, repeat: 1 })` |
| Flash sale timer | No GSAP — pure `setInterval` for the countdown. GSAP pulse when under 60 seconds: `gsap.to(timer, { scale: 1.05, duration: 0.5, yoyo: true, repeat: -1 })` |
| Variant selection | `gsap.to(selectedPill, { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 })` |
| Filter sheet open | Handled by shadcn/ui Sheet animation |
| Scroll-triggered animations | Use `gsap.ScrollTrigger` for the stagger animations on collection/product grids |

---

## Validation

### Newsletter subscription
```typescript
z.object({ email: z.string().email('Enter a valid email address') })
```

### Variant selection
- All attributes must have a selected option before "Add to cart" is enabled
- If a selected combination is invalid (not in `product.variants`), show "Unavailable in this combination" and disable CTAs
- This is client-side validation only — no API validation needed

---

## Error Handling

| Scenario | Handling |
|---|---|
| Product not found in Sanity | `notFound()` → 404 |
| Product status is 'draft' | `notFound()` → 404 |
| Occasion not found or inactive | `notFound()` → 404 |
| Collection not found or inactive | `notFound()` → 404 |
| Selected variant combination invalid | Disable CTAs, show "Unavailable in this combination" |
| Variant `available=false` | Show "Sold out" badge on option pill, disable CTAs if all variants sold out |
| Flash sale ends while on product page | Timer hits 0 → refetch Sanity data → update displayed price to regular price |
| Add to wishlist fails | Toast: "Couldn't add to wishlist. Try again." |
| Newsletter already subscribed | Toast: "You're already subscribed." |
| Sanity fetch fails | Show error boundary with "Couldn't load products. Try refreshing." |

---

## Loading States

| State | Implementation |
|---|---|
| Occasions page | Skeleton grid of occasion cards |
| Collection page | Skeleton product grid (8 skeleton cards) |
| Product detail | Skeleton for image + skeleton for info column |
| Load more button | "Loading…" + spinner, appended cards animate in |
| Add to cart | Button shows "Adding…" for 300ms then reverts (optimistic) |
| Add to wishlist | Button shows "Saving…" then "Added ✓" |
| Search results | Skeleton grid while fetching |

---

## Edge Cases

1. **Flash sale ends while product is in someone's cart** — on cart open, prices are refreshed from Sanity. If the sale has ended, show the regular price with a note: "The flash sale for this item has ended." The checkout uses the price at order-creation time (server-fetched, not client-submitted).

2. **Product with no images** — always show a fallback: a grey square with a centered `Gift` icon (lucide-react, 40px, muted). Never a broken image.

3. **Product with `hasVariants=true` and only one available variant combination** — still show the variant selector so the user explicitly selects it. Don't auto-select the only available option silently.

4. **Product removed from Sanity while it's in a user's wishlist** — the wishlist item row still has the snapshot title and image from when it was added. The product detail page at `/product/[slug]` will 404 — but the wishlist item itself still shows using the snapshot data. No broken experience.

5. **Search query with GROQ special characters** — Sanity's client handles parameterized queries safely. The query string is never interpolated directly into GROQ.

6. **Very long product title in cards** — truncate at 2 lines with `-webkit-line-clamp: 2`. Full title visible on the product detail page.

7. **`revalidate = 60`** — Sanity data is cached for 60 seconds. If the catalog team updates a product in Sanity Studio, changes appear within 60 seconds without a deployment. This is an acceptable delay for catalog content.

---

## Analytics Events

```typescript
'museum.home.viewed'                    // {}
'museum.occasion.viewed'               // { occasion_slug, collection_count }
'museum.collection.viewed'             // { collection_slug, occasion_slug, product_count }
'museum.product.viewed'                // { product_id, has_variants, is_on_sale, price }
'museum.product.variant_selected'      // { product_id, attribute, value }
'museum.product.add_to_cart'           // { product_id, variant_key, quantity, price }
'museum.product.add_to_wishlist'       // { product_id, wishlist_type: 'evergreen' | 'occasion' }
'museum.product.image_swapped'         // { product_id, image_index }
'museum.search.submitted'              // { query, result_count }
'museum.search.no_results'             // { query }
'museum.search.result_clicked'         // { query, product_id, position }
'museum.filter.applied'                // { filter_type, value }
'museum.sort.changed'                  // { sort_by }
'museum.load_more.clicked'             // { page, collection_slug }
'museum.flash_sale_banner.clicked'     // {}
'newsletter.subscribed'                // {}
```

---

## Acceptance Criteria

- [ ] Homepage shows occasion grid, featured products, and flash sale banner (when active)
- [ ] `/occasions` renders all active Sanity occasions with their cover images
- [ ] `/occasions/[slug]` renders the correct occasion with all its active collections
- [ ] `/collections/[slug]` renders the collection's products with working load-more pagination
- [ ] Client-side filters (price range) correctly filter the loaded product set
- [ ] `/product/[slug]` renders all product fields: images, title, price, variants, description, reviews
- [ ] Variant selection correctly resolves to a `combinationKey` and enables/disables CTAs
- [ ] Flash sale price shows when `now` is within `saleStartTime` and `saleEndTime`
- [ ] Flash sale timer counts down to 0 and triggers a price refresh
- [ ] "Add to cart" adds the item to cart context with correct price — cart count updates in navbar
- [ ] "Add to wishlist" creates the correct `wishlist_items` row with `origin='catalog'`
- [ ] Unauthenticated user tapping "Add to wishlist" sees the auth gate sheet
- [ ] `/search?q=[query]` returns matching active products from Sanity
- [ ] Empty search query redirects to `/shop`
- [ ] All pages are server-rendered (appear in `curl` as readable HTML)
- [ ] All inactive/draft products return 404

---

## What This Feature Does NOT Include

- Flutterwave payment processing — "Add to cart" adds to local state only; checkout is in the Commerce spec
- Persisted cart (server-side) — cart is client-side only in v1
- Review submission — reading reviews is here; writing reviews is in the Reviews spec
- Flash sale dedicated page (`/flash-sale`) — covered in the Flash Sales spec