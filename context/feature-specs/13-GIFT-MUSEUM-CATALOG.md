# Feature: Gift Museum & Catalog

## Overview
The editorial product discovery layer — occasion-themed browsing that makes gift shopping feel curated rather than transactional. Content is entirely managed in Sanity CMS. Three levels: Occasions → Collections → Products. Includes a product detail page with variant selection, a search experience, and an "Add to wishlist" integration. This is distinct from the cart/checkout flow — this feature covers discovery and wishlist addition; purchasing from the catalog is handled in `07-COMMERCE`.

---

## Goals
- Create a gift-discovery experience organized around occasions (birthday, wedding, etc.) rather than generic product categories.
- Surface curated editorial collections within each occasion.
- Allow products to be added to a wishlist directly from browse/detail pages.
- Support search across the catalog.

---

## User Stories
- As a shopper, I can browse gifts organized by occasion type.
- As a shopper, I can browse a curated collection within an occasion.
- As a shopper, I can view full product detail, select variants, and see current pricing including flash sale prices.
- As a shopper, I can add a product to my wishlist from any product card or detail page.
- As a shopper, I can search for a product by name.
- As a giver browsing for someone else, I can add a product directly to my cart.

---

## Functional Requirements
1. Occasions page (`/occasions`): lists all active Sanity `occasion` documents with cover image, title, and product count.
2. Occasion detail page (`/occasions/[slug]`): shows the occasion's collections with featured products per collection.
3. Collection page (`/collections/[slug]`): paginated product grid for one collection (12 per page).
4. Product detail page (`/product/[slug]`): full product info, variant selector (if `hasVariants=true`), flash sale countdown (if active), reviews tab, add-to-wishlist + add-to-cart actions.
5. Shop page (`/shop`): all products paginated, filterable by occasion and price range.
6. Search page (`/search?q=`): product search results using Sanity's GROQ `match` on title/description/tags.
7. "Add to wishlist" from a product card or detail page: if the user is authenticated, opens a wishlist picker (choose which wishlist — evergreen or an active occasion). If unauthenticated, redirects to login with `redirect` back.
8. All Sanity pages use `revalidate = 60` (ISR) — catalog content doesn't need real-time freshness.
9. Flash sale badge and timer shown on product cards and detail pages when `saleStartTime <= now <= saleEndTime`.

---

## Non-Functional Requirements
- All catalog pages must be server-rendered (Next.js server components with ISR).
- Product grids must handle 0, 1, and 100+ products without layout issues.
- Images served from Sanity CDN via `@sanity/image-url` builder.

---

## UI Requirements

### `/occasions` — Occasions index
- Page title: "The Gift Museum"
- Grid of occasion cards (2 col mobile, 3–4 desktop): cover image, occasion name, "X collections" count.
- Clicking a card → `/occasions/[slug]`.

### `/occasions/[slug]` — Occasion detail
- Hero section: full-width cover image, occasion title, description.
- Collections grid below: each collection as a section with title, description, and a horizontal scroll (mobile) / 3-col grid (desktop) of up to 4 featured products.
- "View all [Collection Name]" link per collection.

### `/collections/[slug]` — Collection page
- Header: collection name + description.
- Product grid (2 col mobile, 3–4 desktop) with pagination.
- Back link: "← [Occasion Name]".

### `/product/[slug]` — Product detail

**Image gallery:**
- Primary image: large, full width on mobile, 50% on desktop.
- Thumbnail strip below for multiple images.

**Product info:**
- Title (h1), brand/supplier (if shown).
- Price section:
  - No flash sale: `formatPrice(basePrice)` (or cheapest variant price if has variants).
  - Active flash sale: sale price (large, brand red) + original price (strikethrough, muted) + "Save X%" badge + `FlashSaleTimer` component.
- Description (rich text from Sanity Portable Text).

**Variant selector** (if `hasVariants=true`):
- Per attribute (e.g. Size, Color): button group.
- Color attributes: color swatch buttons.
- Invalid/unavailable combinations: disabled, strikethrough label.
- Selected state: brand-filled button.
- "Please select a [attribute]" validation hint shown if user tries to add to cart/wishlist without selecting.

**Actions:**
- "Add to cart" (filled, full width on mobile) — requires valid variant if applicable.
- "Add to wishlist" (ghost, full width on mobile) — opens wishlist picker.

**Reviews tab:**
- Shown below the product info.
- Rating summary: average stars + breakdown chart.
- Paginated review cards.
- "Write a review" CTA (only shown to verified purchasers — see `09-REVIEWS`).

**Related products:**
- Horizontal scroll strip: "More from this collection" — 4–6 products.

### Product card (reusable `ProductCard` component)
- Image (3:4 aspect ratio), title (2 lines), price, flash sale badge if active.
- "Add to wishlist" heart icon (top right corner) — fills on hover/tap.
- Clicking card body → product detail page.

### Wishlist picker (sheet/dialog)
Shown when "Add to wishlist" clicked on an authenticated user:
- "Add to which wishlist?"
- Option: "My Wishlist (evergreen)" + item count
- Option per active occasion: "[Occasion Name]" + date
- "Create new occasion" link at bottom
- On select: calls `/api/wishlists/[id]/items` POST with `origin='catalog'`.
- Success: toast "Added to [Wishlist Name] ✓".

---

## Backend Logic

### GROQ queries (all in `lib/sanity/queries.ts`)

**Occasions index:**
```groq
*[_type == "occasion" && !(_id in path("drafts.**"))] {
  _id, title, slug, coverImage, description,
  "collectionCount": count(*[_type == "collection" && occasion._ref == ^._id])
} | order(title asc)
```

**Occasion detail:**
```groq
*[_type == "occasion" && slug.current == $slug][0] {
  ...,
  "collections": *[_type == "collection" && occasion._ref == ^._id] {
    _id, title, slug, description,
    "featuredProducts": *[_type == "product" && references(^._id)][0..3] {
      _id, title, slug, basePrice, salePrice, saleStartTime, saleEndTime,
      "primaryImage": images[0], hasVariants,
      "variants": variants[]{ price }
    }
  }
}
```

**Product detail:**
```groq
*[_type == "product" && slug.current == $slug][0] {
  _id, title, slug, description, basePrice, baseSku,
  salePrice, saleStartTime, saleEndTime,
  hasVariants,
  images[]{ ..., asset-> },
  attributes[]{ name, options[]{ value, label } },
  variants[]{ combinationKey, price, supplierSku, available },
  "collections": *[_type == "collection" && references(^._id)]{ title, slug, occasion-> { title, slug } },
  "relatedProducts": *[_type == "product" && references(*[_type == "collection" && references(^._id)]._id)][0..5] {
    _id, title, slug, basePrice, "primaryImage": images[0]
  }
}
```

**Search:**
```groq
*[_type == "product" && [title, description, pt::text(description)] match $query] {
  _id, title, slug, basePrice, salePrice, saleStartTime, saleEndTime,
  "primaryImage": images[0], hasVariants,
  "variants": variants[]{ price }
} | score(boost(title match $query, 3), description match $query) [0..23]
```

### Current price helper
```typescript
// lib/sanity/pricing.ts
export function getActivePrice(product: SanityProduct): number {
  const now = new Date()
  const saleActive = product.saleStartTime && product.saleEndTime
    && new Date(product.saleStartTime) <= now
    && new Date(product.saleEndTime) > now
  
  if (saleActive && product.salePrice) return product.salePrice
  if (product.hasVariants) {
    // Return cheapest available variant price
    const prices = product.variants?.filter(v => v.available).map(v => v.price) || []
    return prices.length > 0 ? Math.min(...prices) : product.basePrice
  }
  return product.basePrice
}
```

### "Add to wishlist" from catalog
Calls `POST /api/wishlists/[id]/items` with:
```json
{
  "origin": "catalog",
  "catalog_product_id": "<sanity _id>",
  "variant_combination_key": "<selected variant key or null>"
}
```

---

## Database Changes
No new Supabase tables. Sanity schema additions needed:

**Add to `product` schema in `sanity/schemaTypes/product.ts`:**
```typescript
{
  name: 'salePrice',
  title: 'Sale Price (₦)',
  type: 'number',
  description: 'Price during flash sale period. Leave empty if no flash sale.',
},
{
  name: 'saleStartTime',
  title: 'Sale Start Time',
  type: 'datetime',
},
{
  name: 'saleEndTime',
  title: 'Sale End Time',
  type: 'datetime',
},
```

---

## API Endpoints

### `GET /api/search`
Proxy for Sanity GROQ search (or handled directly as a server component page).
**Auth:** none.
**Query:** `?q=searchTerm`
**Response:** `{ products: ProductCard[] }`.

All other data fetching is done directly from server components using the Sanity client — no Next.js API routes needed for read-only catalog data.

---

## Permissions and Authorization
- All catalog pages: public — no auth required.
- "Add to wishlist" action: requires auth (redirects to login if not authenticated).
- Search: public.

---

## Validation

Variant selection: client-side — "Add to cart" and "Add to wishlist" buttons disabled until a valid `combinationKey` is selected (if `hasVariants=true`).

Search query: `q` param must be non-empty and at least 2 characters before a Sanity query fires. Debounce input by 300ms.

---

## Error Handling

| Scenario | User-facing behavior |
|---|---|
| Product slug not found in Sanity | `notFound()` → 404 page |
| Occasion slug not found | `notFound()` → 404 page |
| Sanity fetch error | Error boundary: "Couldn't load this page. Please try refreshing." |
| Add to wishlist fails | Toast: "Couldn't add to wishlist. Please try again." |
| Search returns 0 results | "No products found for '[query]'. Try different keywords." |
| Invalid variant combination | Disable the combo — don't show an error, just prevent selection |

---

## Loading and Empty States

- **Occasions index:** skeleton grid (4 cards).
- **Product grid:** skeleton cards matching ProductCard dimensions.
- **Product detail:** skeleton layout matching the 2-column split.
- **Search:** skeleton results while query runs; empty state if 0 results.
- **No occasions in Sanity:** "Coming soon — we're curating the perfect gift ideas." (editor should never ship with zero occasions, but defensive).
- **Collection with 0 products:** "No products in this collection yet." (shouldn't happen but defensive).

---

## Edge Cases

1. **Product archived in Sanity after being added to a wishlist.** The `wishlist_items` row still exists with snapshot data. On the shared wishlist view, the "Buy" CTA should be suppressed — check if `catalog_product_id` is still active in Sanity. Batch-check at render time: `*[_type == "product" && _id in $ids && !archived]`.

2. **Flash sale starts while the product detail page is open (ISR, 60-second cache).** The sale price won't appear until the next revalidation. This is acceptable — a 60-second delay for a flash sale display is fine. The sale price at checkout is always the authoritative current price (re-fetched server-side).

3. **Product has `hasVariants=true` but `variants` array is empty in Sanity** (data entry error). "Add to cart" and "Add to wishlist" should be disabled with a message: "This product is temporarily unavailable." Don't crash the page.

4. **Search query contains special characters** (e.g. `"` or `*`). Sanity's GROQ `match` handles most cases gracefully, but sanitize the input: strip characters that could break the GROQ string before passing to the query.

5. **More than one wishlist picker option** — user has evergreen + 3 active occasions. The picker sheet scrolls. Cap at showing 6 options + "Create new occasion" without making the sheet overwhelming.

6. **Product is on flash sale with `salePrice` higher than `basePrice`** (data entry error). `getActivePrice` should always return `min(salePrice, basePrice)` to prevent the "sale" from showing a price increase. Sanity Studio validation rule should prevent this, but add a runtime guard.

---

## Analytics / Events
- `catalog.occasion.viewed` (slug)
- `catalog.collection.viewed` (slug)
- `catalog.product.viewed` (product_id, has_flash_sale: bool)
- `catalog.product.add_to_wishlist` (product_id, destination_wishlist_type)
- `catalog.product.add_to_cart` (product_id, has_variant: bool)
- `catalog.search.performed` (query, result_count)
- `catalog.search.product_clicked` (product_id, position)

---

## Testing Requirements

### Unit tests
- `getActivePrice`: all cases — no sale, active sale, sale with variants, expired sale.
- Variant `buildCombinationKey`: consistent output for same inputs in different order.
- Search query sanitization: special characters removed correctly.

### Integration / E2E tests
- Navigate occasions → collection → product detail: all pages load without errors.
- Add to wishlist from product detail (authenticated): `wishlist_items` row created with `origin='catalog'`.
- Add to wishlist unauthenticated: redirects to login with correct `redirect` param.
- Search: returns relevant results for a known product title.

### Manual QA
- Add flash sale fields to a Sanity product (via Studio), verify sale price + countdown appear on the product detail page within 60 seconds.
- Select an invalid variant combination — verify it cannot be selected.
- Add a product to wishlist from the product card hover state — verify wishlist picker appears.
- Add a product to wishlist from the detail page — verify it appears in the correct wishlist on the dashboard.

---

## Acceptance Criteria
- [ ] All occasion, collection, and product pages render correctly from Sanity data.
- [ ] Flash sale pricing and countdown display correctly when a sale is active.
- [ ] Variant selector disables invalid combinations and requires a selection before add-to-cart/wishlist.
- [ ] "Add to wishlist" creates a catalog-origin `wishlist_items` row with the correct `catalog_product_id`.
- [ ] Search returns relevant results for known product names.
- [ ] Unauthenticated users can browse all catalog pages but are redirected to login for wishlist actions.
- [ ] A product archived in Sanity does not show a "Buy" CTA on the shared wishlist view.

---

## Future Improvements
- Faceted filtering on collection/shop pages (price range, occasion, supplier).
- "Customers also bought" recommendations.
- Product availability stock level indicators.
- Sanity Studio preview of flash sale appearance before activating.
- Occasion-based landing pages with custom URLs for marketing campaigns.
