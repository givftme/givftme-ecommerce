# Feature: Catalog Item Addition to Wishlist

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
1. "Add to wishlist" (heart icon or button) on `ProductCard` and on the product detail page.
2. Requires auth — unauthenticated click redirects to `/auth/login?redirect=[current_path]`.
3. A **wishlist picker** appears: shows the user's evergreen wishlist + all active occasion wishlists. User selects one.
4. On confirm: `POST /api/wishlists/[id]/items` with `origin='catalog'` and `catalog_product_id`.
5. Snapshot at add-time: `title`, `image_url`, `price` are fetched from Sanity and stored on the `wishlist_items` row as a display snapshot — used for fast rendering without re-querying Sanity every time. Live price is still checked at purchase/checkout time.
6. No variant selection at add-to-wishlist time. The `variant_combination_key` on the `wishlist_items` row is null for catalog items added via wishlist (set at checkout time by the giver).
7. If the product is already on the selected wishlist, show: "Already on this wishlist" — no duplicate row created.
8. After adding: the heart icon on the product card fills (indicating wishlisted state). Hovering the filled heart shows a tooltip: "On your wishlist → View".

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

### Wishlist picker (shadcn Sheet on mobile, Dialog on desktop)

**Title:** "Add to which wishlist?"

**Options list:**
Each option as a selectable row:
- Icon (gift box for evergreen, occasion-type icon for occasions)
- Wishlist name
- Item count ("12 items")
- For occasions: date badge ("Jul 15" or "In 23 days")
- Checkmark on the currently selected row

**Footer:**
- "Add to [Selected Wishlist]" CTA (filled, disabled until a selection is made)
- "Create new occasion" text link

**Empty state** (no wishlists — should never happen due to auto-create, but defensive):
"Create a wishlist first" + CTA.

---

## Backend Logic

### Check if already wishlisted (for heart state on product cards)
On the server component rendering the product grid, fetch the current user's wishlisted catalog product IDs:

```typescript
// If authenticated:
const { data } = await supabase
  .from('wishlist_items')
  .select('catalog_product_id, wishlist_id')
  .eq('wishlists.user_id', userId) // via join
  .eq('origin', 'catalog')
  .not('catalog_product_id', 'is', null)

const wishlistedIds = new Set(data.map(item => item.catalog_product_id))
```

Pass `wishlistedIds` to `ProductGrid` → `ProductCard`.

### Add catalog item to wishlist (`POST /api/wishlists/[id]/items`)
```typescript
// origin = 'catalog' branch:

// 1. Fetch current product data from Sanity
const product = await sanity.fetch(PRODUCT_BY_ID_QUERY, { id: catalog_product_id })
if (!product) return 422 { error: 'Product not found in catalog' }

// 2. Check for existing item (duplicate prevention)
const existing = await supabase
  .from('wishlist_items')
  .select('id')
  .eq('wishlist_id', wishlist_id)
  .eq('catalog_product_id', catalog_product_id)
  .single()

if (existing.data) return 409 { error: 'already_on_wishlist', message: 'Already on this wishlist' }

// 3. Get current display price
const { price } = getActivePrice(product)

// 4. Get next sort_order
const { data: maxSort } = await supabase
  .from('wishlist_items')
  .select('sort_order')
  .eq('wishlist_id', wishlist_id)
  .order('sort_order', { ascending: false })
  .limit(1)
  .single()

const sort_order = (maxSort?.sort_order ?? 0) + 1

// 5. Create master_items row (for evergreen tracking)
const { data: master } = await supabase.from('master_items').insert({
  user_id: auth.uid(),
  title: product.title,
  image_url: urlFor(product.images[0]).width(400).url(),
  price: price,
  origin: 'catalog',
  catalog_product_id: catalog_product_id,
}).select().single()

// 6. Create wishlist_items row
const { data: item } = await supabase.from('wishlist_items').insert({
  wishlist_id: wishlist_id,
  master_item_id: master.id,
  title: product.title,
  image_url: urlFor(product.images[0]).width(400).url(),
  price: price,
  origin: 'catalog',
  catalog_product_id: catalog_product_id,
  sort_order: sort_order,
  is_exclusive: false,
}).select().single()

return 201 { item }
```

### Wishlist picker data (`GET /api/wishlists?for_picker=true`)
```typescript
const wishlists = await supabase
  .from('wishlists')
  .select('id, title, type, occasion_id, occasions(occasion_type, occasion_date)')
  .eq('user_id', auth.uid())
  .in('type', ['evergreen', 'occasion'])
  .order('type', { ascending: false }) // evergreen first

// Get item counts:
const counts = await supabase
  .from('wishlist_items')
  .select('wishlist_id, count')
  .in('wishlist_id', wishlists.data.map(w => w.id))
  .group('wishlist_id')
```

---

## Database Changes
No new tables. Uses existing `wishlist_items`, `master_items`, `wishlists`.

Confirm `wishlist_items` has `catalog_product_id TEXT` (Sanity _id, not a FK — Sanity docs aren't in Supabase).

---

## API Endpoints

### `POST /api/wishlists/[id]/items` (catalog branch)
Already specified in `02-wishlist-core/01-EVERGREEN-WISHLIST.md`. This spec documents the `origin='catalog'` code path within the same route.

### `GET /api/wishlists?for_picker=true`
Returns the user's wishlists formatted for the picker UI.
**Auth:** required.
**Response:** `{ wishlists: WishlistPickerOption[] }`

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
| Product not found in Sanity | "This product is no longer available." |
| Already on wishlist | "Already on this wishlist." (show link to the wishlist) |
| Add fails (network) | "Couldn't add to wishlist. Please try again." |
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
- Duplicate detection: adding same product to same wishlist returns 409, no second row created.
- Archived Sanity product: returns 422, no row created.

### Manual QA
- Click the heart icon on a product card (authenticated). Verify the picker opens.
- Select the evergreen wishlist. Verify item appears in `/dashboard/wishlists` with correct title/image.
- Click the heart again. Verify "Already on this wishlist" message (or navigate to wishlist behavior).
- Add the same product to an occasion wishlist. Verify both wishlists show the item independently.
- Archive the product in Sanity. On the shared wishlist view, verify "No longer available" overlay appears.

---

## Acceptance Criteria
- [ ] "Add to wishlist" on product cards and detail pages opens a wishlist picker for authenticated users.
- [ ] Unauthenticated users are redirected to login with a `redirect` param.
- [ ] A catalog item added to a wishlist creates a `wishlist_items` row with `origin='catalog'` and a snapshot of current title/image/price.
- [ ] Adding the same product to the same wishlist twice shows "Already on this wishlist" and creates no duplicate row.
- [ ] The heart icon on the product card fills to indicate wishlisted state.
- [ ] After adding, the user sees a confirmation toast or the button changes to "On your wishlist ✓".

---

## Future Improvements
- Variant selection at wishlist-add time (optional, with a clear "giver can choose" note to the receiver).
- "Move to occasion" action (move an evergreen item to a specific occasion without re-adding).
- "Remove from wishlist" from the product card in a single tap (currently requires navigating to the wishlist).
