# Feature: Catalog Item Addition to Wishlist

> **Status note (2026-07-30):** This feature is shipped. Several details below (query name, error codes, `master_items` scope, picker UI) originally described in this spec diverged from what was actually built, per [[feedback-spec-vs-architecture-precedence]] — this file has been corrected to match `app/api/wishlists/[id]/items/route.ts`, `components/shared/WishlistPickerSheet.tsx`, and `context/architecture/API_ROUTES.md`, which are the source of truth. Treat this as documentation of shipped behavior, not a build target.

## Overview
Lets authenticated users add a Gifvtme catalog product directly to their wishlist from any product card or detail page. Creates a `wishlist_items` row with `origin='catalog'` and snapshotted display data. If the product has variants, variant selection timing follows the "select at purchase time, not at add-to-wishlist time" decision — the wishlist item stores only the `catalog_product_id`, not a specific variant. A wishlist picker lets the user choose which list (evergreen or an active occasion) to add to.

---

## Goals
- Let users build wishlists from Gifvtme's own catalog, not just external URLs.
- Make the add-to-wishlist action fast and low-friction from browse and detail pages.
- Support both evergreen and occasion destinations.
- Keep variant selection at purchase time to avoid the receiver having to pre-specify sizes/colors they might get wrong.

---

## User Stories
- As a receiver browsing the catalog, I can add a product to my wishlist in two taps.
- As a receiver, I choose which wishlist to add a catalog product to (evergreen or a specific occasion).
- As a giver or receiver, after adding to wishlist I see immediate confirmation.
- As a receiver, catalog items on my wishlist show current pricing when my wishlist is viewed.

---

## Functional Requirements
1. "Add to wishlist" (heart icon or button) on `ProductCard` and on the product detail page. On `ProductCard` the heart is hidden when `product.isNew` is true (an existing, undocumented-until-now UI decision — not something this feature should change without a separate conversation).
2. Requires auth — an unauthenticated click opens `AuthGateSheet` with a `redirectPath` back to the current page (not a hard redirect to `/auth/login`).
3. A **wishlist picker** (`WishlistPickerSheet`, Sheet only — no separate desktop Dialog variant) shows the user's wishlists. If the user has exactly one wishlist, the picker skips straight to adding rather than showing a selection UI. If they have none, one is auto-created (`ensureEvergreenWishlist`) and used directly. The picker only surfaces a choice when 2+ wishlists exist.
4. On confirm (or auto-select): `POST /api/wishlists/[id]/items` with `origin='catalog'` and `catalog_product_id`.
5. Snapshot at add-time: `title`, `image_url`, `price` are re-fetched from Sanity server-side and stored on the `wishlist_items` row as a display snapshot — client-submitted values for these fields are accepted for schema compatibility but ignored. Live price is still checked at purchase/checkout time.
6. No variant selection at add-to-wishlist time. The `variant_combination_key` on the `wishlist_items` row is null for catalog items added via wishlist (set at checkout time by the giver).
7. If the product is already on the selected wishlist, the route returns 409 and the picker's toast shows the server's message ("Already on this wishlist.") — no duplicate row created.
8. After adding: the heart icon on the product card fills (indicating wishlisted state), backed by `GET /api/wishlists/catalog-items` fetched client-side in `CatalogProductGrid` and updated locally on a successful add. The hover tooltip / "On your wishlist → View" navigation described below is not implemented — clicking a filled heart currently re-opens the same add flow rather than navigating or offering removal.

---

## Non-Functional Requirements
- The wishlist picker must load in under 1 second (fetching the user's wishlists from Supabase).
- The add action (POST) must complete in under 2 seconds.

---

## UI Requirements

### Product card — "Add to wishlist" heart icon
- Top-right corner of the product image.
- Default: empty heart (`Heart` from lucide-react, stroke only).
- Wishlisted state: filled heart (`Heart` with fill, brand red).
- On hover (desktop): tooltip "Add to wishlist" (empty) or "On your wishlist" (filled).
- On click (empty state): opens wishlist picker.
- On click (filled state): navigates to the wishlist or opens a "remove from wishlist?" confirmation.

### Product detail page — "Add to wishlist" button
- Below the "Add to cart" button.
- Ghost variant, full width on mobile.
- Label: "Add to wishlist" (empty heart icon + text).
- After adding: changes to "On your wishlist ✓" with a filled heart.

### Wishlist picker — as shipped (`WishlistPickerSheet`)

Sheet only (all breakpoints) — no desktop Dialog variant exists.

**Title:** "Add to which wishlist?"

**Behavior, not a static options list:**
- 0 wishlists: auto-creates an evergreen wishlist and adds directly — no UI shown beyond a brief loading state.
- 1 wishlist: adds directly, no selection step.
- 2+ wishlists: shows each as a row (gift icon, "My Wishlist" for evergreen or the wishlist's title, and its `type`). Clicking a row adds immediately — there is no separate "confirm" step, no item counts, no occasion date badges, and no "Create new occasion" link.

**Cancel:** a text-button "Cancel" closes the sheet without adding.

**Future improvement (not yet built):** item counts, occasion date badges, a confirm-footer step, and "Create new occasion" from the picker — these remain the original spec's intent but are not implemented.

---

## Backend Logic

### Check if already wishlisted (for heart state on product cards)
`CatalogProductGrid` fetches `GET /api/wishlists/catalog-items` client-side on mount (unauthenticated users get `{ catalogProductIds: [] }`, not a 401 — this is a passive display check on a public browsing surface, not a gated action). The route calls `getWishlistedCatalogProductIds()` in `lib/wishlist/server.ts`:

```typescript
// lib/wishlist/server.ts
export async function getWishlistedCatalogProductIds(supabase, userId) {
  const { data: wishlists } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', userId)

  const wishlistIds = (wishlists || []).map((w) => w.id)
  if (wishlistIds.length === 0) return []

  const { data: items } = await supabase
    .from('wishlist_items')
    .select('catalog_product_id')
    .in('wishlist_id', wishlistIds)
    .eq('origin', 'catalog')
    .not('catalog_product_id', 'is', null)

  return [...new Set(items.map((item) => item.catalog_product_id))]
}
```

`CatalogProductGrid` holds the result in local state, passes it to `ProductGrid` as `wishlistedIds`, and adds the new ID locally the moment `WishlistPickerSheet`'s `onAdded` callback fires — no refetch needed after an add.

### Add catalog item to wishlist (`POST /api/wishlists/[id]/items`, origin='catalog' branch)
As implemented in `app/api/wishlists/[id]/items/route.ts`:

```typescript
// 1. Fetch current product data from Sanity — CART_PRICES_QUERY, not a PRODUCT_BY_ID_QUERY
//    (that query name never existed; CART_PRICES_QUERY is shared with the cart price-refresh route)
const products = await sanityFetch(CART_PRICES_QUERY, { ids: [catalog_product_id] })
const product = products.find((p) => p._id === catalog_product_id) ?? null
if (!product || product.status !== 'active') return 400 { error: 'This product is no longer available.' }

// 2. Check for existing item (duplicate prevention) — 409, not part of the original build,
//    added as a follow-up gap-close; application-level check only, no DB unique constraint
const { data: duplicate } = await supabase
  .from('wishlist_items')
  .select('id')
  .eq('wishlist_id', wishlist_id)
  .eq('catalog_product_id', catalog_product_id)
  .limit(1)
  .maybeSingle()

if (duplicate) return 409 { error: 'Already on this wishlist.' }

// 3. Price: getFromPrice() — for variant products, cheapest available variant price
//    (not a flat getActivePrice() call, which would silently save price: 0 for variant products)
const price = getFromPrice(product)
if (price === null) return 400 { error: 'This product is currently unavailable.' }

// 4. Get next sort_order (getNextSortOrder helper)

// 5. Create wishlist_items row (master_item_id: null — occasion pulls set this, not catalog adds)
const { data: item } = await supabase.from('wishlist_items').insert({
  wishlist_id, origin: 'catalog', master_item_id: null,
  title: product.title, image_url: catalogImageUrl, price, catalog_product_id,
  is_exclusive: owner.wishlist.type === 'occasion' && data.is_exclusive,
  sort_order: nextSortOrder,
}).select().single()

// 6. Mirror into master_items — evergreen wishlists ONLY. master_items is the evergreen pool
//    (see DATABASE_SCHEMA.md); occasion-wishlist adds do not touch it.
if (owner.wishlist.type === 'evergreen') {
  await supabase.from('master_items').insert({
    user_id, title: product.title, image_url: catalogImageUrl, price,
    origin: 'catalog', catalog_product_id, sort_order: nextSortOrder,
  })
}

return 201 { item }
```

### Wishlist picker data
The picker uses plain `GET /api/wishlists` (see `API_ROUTES.md`) — a `for_picker=true` param and occasion-joined response shape were never built and would duplicate this endpoint. It returns `{ id, title, type, visibility, prices_visible, item_count }[]`, which is all the picker's row rendering needs.

---

## Database Changes
No new tables. Uses existing `wishlist_items`, `master_items`, `wishlists`.

Confirm `wishlist_items` has `catalog_product_id TEXT` (Sanity _id, not a FK — Sanity docs aren't in Supabase).

---

## API Endpoints

### `POST /api/wishlists/[id]/items` (catalog branch)
Already specified in `02-wishlist-core/01-EVERGREEN-WISHLIST.md`. This spec documents the `origin='catalog'` code path within the same route. See `API_ROUTES.md` for the current, authoritative contract (status codes, `master_items` scoping, duplicate handling).

### `GET /api/wishlists`
The picker reuses this existing endpoint (see `API_ROUTES.md`) rather than a dedicated `for_picker=true` variant — that param was never built.
**Auth:** required.
**Response:** `{ wishlists: { id, title, type, visibility, prices_visible, item_count }[] }`

### `GET /api/wishlists/catalog-items`
New in this pass. Backs the filled-heart state on `ProductCard`.
**Auth:** optional — unauthenticated requests get `{ catalogProductIds: [] }` with 200.
**Response:** `{ catalogProductIds: string[] }`

---

## Permissions and Authorization
- Adding to wishlist: must be authenticated and own the target wishlist.
- Picker data: user's own wishlists only.

---

## Validation

```typescript
// Additional validation in the items POST route when origin='catalog':
const catalogItemSchema = z.object({
  origin: z.literal('catalog'),
  catalog_product_id: z.string().min(1, "Product ID is required"),
  // variant_combination_key intentionally omitted — not set at wishlist-add time
})
```

---

## Error Handling

| Scenario | Message |
|---|---|
| Product not found or inactive in Sanity | "This product is no longer available." (400, not 422) |
| Already on wishlist | "Already on this wishlist." (409; shown via toast — no link to the wishlist yet) |
| Add fails (network) | "Couldn't add to wishlist. Try again." |
| No wishlists to pick from | "Create a wishlist first." + CTA (defensive — auto-create prevents this) |

---

## Loading and Empty States

- **Heart icon while adding:** brief spinner overlay on the heart, then fills on success.
- **Wishlist picker loading:** skeleton option rows.
- **Add button:** spinner + "Adding…" while the POST is in flight.

---

## Edge Cases

1. **Product archived in Sanity after being added to a wishlist.** The `wishlist_items` row persists with its snapshot data. On the shared wishlist view, check if the `catalog_product_id` still resolves to an active Sanity product — if not, show "No longer available" overlay on the item card.

2. **Flash sale active when item is added to wishlist.** The snapshotted `price` is the sale price at add-time. By the time someone gifts from the wishlist, the sale may have ended. The price on the wishlist card will show the stale sale price (visual inconsistency), but the actual purchase price is re-fetched at checkout. Consider: re-fetch Sanity price on shared wishlist render for catalog items rather than using the snapshot for price display — adds latency but stays accurate. **v1 recommendation: use snapshot for display, note the known limitation.**

3. **Same product added to two different wishlists** (evergreen and an occasion). Allowed — each is a separate `wishlist_items` row. The user sees it on both wishlists. Two givers could independently purchase it from different wishlists — no deduplication between wishlists.

4. **User adds from a product card, then from the detail page again.** The second add detects the existing row (`catalog_product_id` already on that wishlist) and returns 409 with "Already on this wishlist." No duplicate created.

5. **Picker has 0 wishlists** (shouldn't happen due to auto-create, but if auto-create failed). Show "Create a wishlist first" message with a CTA to `/dashboard/wishlists`.

---

## Analytics / Events
- `wishlist.catalog_item_added` (product_id, destination_type: evergreen | occasion)
- `wishlist.picker_opened`
- `wishlist.picker_dismissed`
- `wishlist.already_on_wishlist_shown`

---

## Testing Requirements

### Integration tests
- Add catalog item: `wishlist_items` row has `origin='catalog'`, correct `catalog_product_id`, snapshotted title/image/price.
- Duplicate detection: adding same product to same wishlist returns 409, no second row created. (Shipped 2026-07-30.)
- Archived/inactive Sanity product: returns 400, no row created.
- Evergreen add mirrors into `master_items`; occasion add does not.

### Manual QA
- Click the heart icon on a product card (authenticated). Verify the picker opens.
- Select the evergreen wishlist. Verify item appears in `/dashboard/wishlists` with correct title/image.
- Click the heart again. Verify "Already on this wishlist" message (or navigate to wishlist behavior).
- Add the same product to an occasion wishlist. Verify both wishlists show the item independently.
- Archive the product in Sanity. On the shared wishlist view, verify "No longer available" overlay appears.

---

## Acceptance Criteria
- [x] "Add to wishlist" on product cards and detail pages opens a wishlist picker for authenticated users (auto-adding directly when there are 0 or 1 wishlists).
- [x] Unauthenticated users see `AuthGateSheet` with a `redirectPath` back to the current page (not a hard redirect to `/auth/login`).
- [x] A catalog item added to a wishlist creates a `wishlist_items` row with `origin='catalog'` and a snapshot of current title/image/price.
- [x] Adding the same product to the same wishlist twice returns 409 "Already on this wishlist." and creates no duplicate row.
- [x] The heart icon on the product card fills to indicate wishlisted state (via `GET /api/wishlists/catalog-items`, hydrated client-side in `CatalogProductGrid`).
- [x] After adding, the user sees a confirmation toast. The product-detail "On your wishlist ✓" button-state change described in UI Requirements is not implemented — the button always reads "Add to wishlist".

---

## Future Improvements
- Variant selection at wishlist-add time (optional, with a clear "giver can choose" note to the receiver).
- "Move to occasion" action (move an evergreen item to a specific occasion without re-adding).
- "Remove from wishlist" from the product card in a single tap (currently requires navigating to the wishlist).
