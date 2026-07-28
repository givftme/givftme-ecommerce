# Feature: Evergreen Wishlist

## Overview
The permanent, year-round wishlist that every receiver maintains. This is the foundation of the receiver-first model — a master pool of desired gifts that persists indefinitely and can be pulled into time-bound occasion wishlists. Every user has exactly one evergreen wishlist, auto-created on first dashboard visit if it doesn't yet exist. Items can have two origins: `external` (scraped from the internet) or `catalog` (from Gifvtme's Sanity product catalog).

---

## Goals
- Give every receiver a permanent "master list" of things they'd love as gifts.
- Be the source pool for occasion wishlists — items pulled into occasions always originate here.
- Support both internet-scraped items and catalog products in a unified list view.
- Allow ordering, editing, and removing items.

---

## User Stories
- As a receiver, I have exactly one evergreen wishlist that's always available.
- As a receiver, I can add a gift idea by pasting a URL and having Gifvtme auto-fill the details.
- As a receiver, if URL scraping fails, I can enter details manually.
- As a receiver, I can add a product from the Gifvtme catalog directly to my wishlist.
- As a receiver, I can edit an item's title, image, price, or notes after adding it.
- As a receiver, I can delete an item I no longer want.
- As a receiver, I can reorder my items to surface priorities.
- As a receiver, I can see which items have already been purchased.

---

## Functional Requirements
1. Exactly one `wishlists` row with `type='evergreen'` per user — enforced by the `one_evergreen_per_user` partial unique constraint.
2. Auto-create the evergreen wishlist on first visit to `/dashboard/wishlists` if the user has none. The auto-created list has `title = 'My Wishlist'`, `visibility = 'private'` by default.
3. Items support two origins: `origin='external'` (scraped/manual) and `origin='catalog'` (Sanity product).
4. External items store: `title`, `image_url`, `product_url`, `affiliate_url`, `price`, `notes`.
5. Catalog items store: `catalog_product_id` (Sanity `_id`), `title` snapshot, `image_url` snapshot, `price` snapshot (all snapshotted at time of addition for display — live price is checked at purchase time).
6. Items can be reordered via drag-and-drop (dnd-kit). Order is persisted via `sort_order` (integer) column on `wishlist_items`.
7. Purchased items remain visible but are visually marked as "Claimed" — they are never automatically hidden or deleted.
8. Items added to an evergreen list also create a corresponding `master_items` row for cross-occasion tracking.
9. Wishlist name is editable.
10. Item count displayed in the page header.

---

## Non-Functional Requirements
- Drag-and-drop reordering must feel immediate — optimistic UI updates before the server confirms.
- Page must handle lists of up to 100 items without performance degradation.
- Item images served from Supabase Storage (manual uploads) or external URLs (scraped). No image proxy in v1 — external images may break if the source site removes them.

---

## UI Requirements

### Route: `/dashboard/wishlists` (or `/dashboard/wishlists/[id]`)

**Header section:**
- Editable wishlist name (click-to-edit inline or pencil icon → modal)
- Item count ("12 items")
- "Share wishlist" CTA (ghost button) → opens sharing settings sheet (see `03-WISHLIST-SHARING.md`)
- "Add item" CTA (filled button, `+` icon)

**Item list:**
Each item renders as a card with:
- Drag handle (left edge, visible on hover/long-press)
- Item image (60×60px thumbnail, rounded-lg). Broken image fallback: gift icon.
- Title (truncated at 2 lines)
- Price (formatted via `formatPrice()`) — shown if set
- Origin badge: external items show retailer favicon or "External", catalog items show "Gifvtme" badge
- "Claimed" badge overlay (brand-light + muted text) for purchased items
- Three-dot menu: Edit, Delete (and "Remove from occasion" if pulled into any active occasion)

**Add item flow:**
1. "Add item" button opens a bottom sheet (mobile) or dialog (desktop).
2. Two tabs: "Add from URL" and "Add manually".
3. URL tab: text input + "Fetch" button. On success, shows an editable preview card. On failure, switches to manual tab with an explanation.
4. Manual tab: Title (required), Image (upload), Price (optional), URL (optional), Notes (optional).
5. On save: item appears at top of list, optimistically inserted.

**Empty state:**
Illustrated empty state with: "Your wishlist is empty" heading, "Add your first wish" sub-copy, large "Add item" CTA.

**All-claimed state:**
If all items are purchased: "Everything's been gifted! 🎉" banner at the top with a CTA to add more items.

**Wishlist name editing:**
Inline: click the name text, it becomes an input. Enter/blur to save. Escape to cancel. Or a pencil icon next to the name triggers the same behavior.

---

## Backend Logic

### Auto-create evergreen wishlist
In the `/dashboard/wishlists` server component:
```
1. Query: SELECT * FROM wishlists WHERE user_id = auth.uid() AND type = 'evergreen'.
2. If no row returned: INSERT INTO wishlists (user_id, title, type, visibility) VALUES (uid, 'My Wishlist', 'evergreen', 'private').
3. Also insert a master_items_enabled flag (no-op if already exists per constraint).
4. Return the wishlist row.
```

### Add external item (after scrape or manual entry)
```
1. Begin transaction.
2. INSERT INTO master_items (user_id, title, image_url, price, product_url, origin, catalog_product_id) VALUES (...).
3. INSERT INTO wishlist_items (wishlist_id, master_item_id, title, image_url, price, product_url, affiliate_url, origin, sort_order) VALUES (..., (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM wishlist_items WHERE wishlist_id = $1)).
4. Commit.
```
`affiliate_url` is built via `lib/affiliate/transform.ts` using `product_url`.

### Add catalog item
```
1. Fetch current product data from Sanity by catalog_product_id: title, image_url, price.
2. Begin transaction.
3. INSERT INTO master_items (user_id, title, image_url, price, origin='catalog', catalog_product_id).
4. INSERT INTO wishlist_items (..., origin='catalog', catalog_product_id, with snapshotted title/image/price).
5. Commit.
```

### Edit item
UPDATE `wishlist_items` and `master_items` in parallel (update both with new title/image/price/notes).

### Delete item
```
1. Check: is this item pulled into any active occasion wishlists?
   SELECT COUNT(*) FROM wishlist_items WHERE master_item_id = $1 AND wishlist_id IN (SELECT id FROM wishlists WHERE type='occasion')
2. If yes: show warning "This item is on [X] occasion wishlist(s). Removing it here will also remove it from those occasions." — require confirmation.
3. DELETE FROM wishlist_items WHERE id = $1 (cascades to occasion copies via master_item_id FK — define this behavior explicitly in the migration).
4. DELETE FROM master_items WHERE id = $1.
```

### Reorder items
On drag-end: batch UPDATE wishlist_items SET sort_order = $newOrder WHERE id = $itemId for all affected items. Use optimistic UI — update local state immediately, sync in background.

---

## Database Changes

Uses existing tables from migrations 001 and 003:
- `wishlists` — `type`, `user_id`, `title`, `visibility`, `prices_visible`
- `wishlist_items` — `wishlist_id`, `master_item_id`, `title`, `image_url`, `price`, `product_url`, `affiliate_url`, `origin`, `catalog_product_id`, `sort_order`, `status`, `is_exclusive`, `gifting_type`
- `master_items` — mirrors `wishlist_items` for the evergreen pool

**Confirm migration 003 added `sort_order` to both `wishlist_items` and `master_items` — if not present, add:**
```sql
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS wishlist_items_sort_order_idx ON wishlist_items(wishlist_id, sort_order);
```

---

## API Endpoints

### `POST /api/wishlists/[id]/items`
Add an item to a wishlist.
**Auth:** required (must be wishlist owner).
**Request body:**
```typescript
{
  origin: 'external' | 'catalog',
  // If external:
  title: string,
  image_url?: string,
  price?: number,
  product_url?: string,
  notes?: string,
  // If catalog:
  catalog_product_id: string,
  // Optional variant info (v2):
  // variant_combination_key?: string,
}
```
**Response:** `{ item: WishlistItem }` on success, `{ error: string }` on failure.

### `PATCH /api/wishlists/[id]/items/[itemId]`
Edit an item.
**Auth:** required (must be wishlist owner).
**Request body:** partial — any of `title`, `image_url`, `price`, `notes`.
**Response:** `{ item: WishlistItem }`.

### `DELETE /api/wishlists/[id]/items/[itemId]`
Remove an item.
**Auth:** required (must be wishlist owner).
**Query param:** `?force=true` to skip the occasion-membership warning and delete anyway.
**Response:** `{ deleted: true }` or `{ warn: true, occasion_count: number }` (if item is on occasions and `force` not set).

### `PATCH /api/wishlists/[id]/items/reorder`
Update sort order of all items.
**Auth:** required (must be wishlist owner).
**Request body:** `{ items: Array<{ id: string, sort_order: number }> }`
**Response:** `{ updated: true }`.

### `PATCH /api/wishlists/[id]`
Update wishlist name.
**Auth:** required (must be wishlist owner).
**Request body:** `{ title: string }`.
**Response:** `{ wishlist: Wishlist }`.

---

## Permissions and Authorization
- Only the wishlist owner (`wishlists.user_id = auth.uid()`) can add/edit/delete/reorder items.
- RLS on `wishlist_items`: owner has full CRUD; viewers have read-only (based on wishlist visibility).
- The `one_evergreen_per_user` unique constraint prevents duplicate evergreen wishlists at the DB level — application code must catch the constraint violation if it somehow fires.

---

## Validation

```typescript
const addItemSchema = z.discriminatedUnion('origin', [
  z.object({
    origin: z.literal('external'),
    title: z.string().min(1, "Title is required").max(200),
    image_url: z.string().url().optional().or(z.literal("")),
    price: z.number().positive().optional(),
    product_url: z.string().url().optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    origin: z.literal('catalog'),
    catalog_product_id: z.string().min(1),
  }),
])
```

Wishlist title: `z.string().min(1).max(100)`.

---

## Error Handling

| Error | User-facing message |
|---|---|
| Add item fails (network) | "Couldn't add this item. Please try again." |
| Delete item while on occasions | Warning dialog listing occasions — see Delete item logic above |
| Reorder fails | Silent retry — optimistic UI stays in place; if multiple retries fail, revert to server order and show: "Couldn't save order. Please try again." |
| Wishlist not found | Redirect to `/dashboard/wishlists` (auto-creates if needed) |
| Image upload fails | "Image upload failed. You can still save without an image." |

---

## Loading and Empty States

**Page load:** skeleton cards (matching item card dimensions) while wishlist items load.

**Add item dialog:** "Fetch" button shows a spinner while scraping. If scraping takes >5 seconds, show: "This is taking a while..." with an option to skip to manual entry.

**Item image:** skeleton while loading; gift icon fallback on error.

**Empty wishlist:** illustrated empty state — gift box icon, "Your wishlist is empty", subtext "Start adding things you'd love", large "Add item" CTA.

**All items claimed:** "Everything's been gifted! 🎉" full-width banner, "Add more wishes" CTA below.

---

## Edge Cases

1. **Item deletion with occasion dependencies.** When deleting an item that's been pulled into an active occasion, the UI must warn and require confirmation. The DB delete cascades — but verify FK behavior: if `wishlist_items` in occasions reference `master_item_id` with `ON DELETE CASCADE`, deleting the master item removes the occasion copy too. If `ON DELETE SET NULL`, occasion copies survive but become orphaned. **Define this explicitly: recommend `ON DELETE CASCADE` so there are no orphaned occasion items.**

2. **Scraping returns an image that later goes 404.** The `image_url` stored is external. No automatic dead-link checking in v1. The item continues to display a broken image — the broken image fallback (gift icon) handles this gracefully.

3. **Catalog product archived in Sanity after being wishlisted.** The `wishlist_items` row still exists with its snapshot data. On the shared wishlist view, it should check if `catalog_product_id` still resolves to an active product in Sanity before showing the "Buy" CTA — if not, show "No longer available" (see shared wishlist feature spec).

4. **User has 0 items, navigates to `/dashboard/wishlists`.** Auto-create fires, empty state displays. No error, no flash of a loading state that shows an error before the create completes.

5. **Concurrent add from two browser tabs.** Two `INSERT` operations both compute `MAX(sort_order) + 1` simultaneously and get the same value. This results in two items with the same `sort_order`. This is acceptable in v1 — the reorder drag handles it, and the items both appear (the constraint doesn't enforce uniqueness on `sort_order`).

6. **Reorder a list of 100+ items.** The batch UPDATE on reorder sends a request for every item that shifted position. For large lists, debounce the reorder API call (wait 500ms after drag ends before firing, merge intermediate moves).

---

## Analytics / Events
- `wishlist.evergreen.item_added` (origin: external | catalog)
- `wishlist.evergreen.item_edited`
- `wishlist.evergreen.item_deleted`
- `wishlist.evergreen.item_reordered`
- `wishlist.evergreen.scrape_succeeded`
- `wishlist.evergreen.scrape_failed` (domain: string — track which domains fail for Microlink coverage decisions)
- `wishlist.evergreen.manual_fallback_used`

---

## Testing Requirements

### Unit tests
- `lib/affiliate/transform.ts`: correct affiliate URL building for Jumia, Amazon, Konga, and unknown domains.
- Zod add-item schema: valid/invalid for both origins.

### Integration tests
- Auto-create: verify exactly one evergreen wishlist is created if none exists.
- Add external item: `wishlist_items` and `master_items` rows created with correct data.
- Add catalog item: snapshotted title/image/price saved correctly regardless of subsequent Sanity updates.
- Delete item on occasion: cascade removes the occasion copy.
- Reorder: `sort_order` values updated correctly after a drag.

### Manual QA
- Paste a Jumia URL, verify auto-fill and affiliate URL transformation.
- Paste an Amazon URL that Microlink fails to scrape, verify manual fallback activates.
- Add a catalog product from the product detail page, verify it appears in the evergreen list.
- Reorder items via drag-and-drop, refresh the page, verify order persists.
- Delete an item that's on an active occasion, verify warning appears and cascade works.

---

## Acceptance Criteria
- [ ] Every user has exactly one evergreen wishlist, auto-created on first dashboard visit.
- [ ] An item added via URL scraping appears with correct title, image, and price (or a usable fallback).
- [ ] A scrape failure activates the manual entry form without blocking item creation.
- [ ] An item added via catalog origin stores `catalog_product_id` and a price snapshot.
- [ ] Items can be reordered and the new order persists after a page reload.
- [ ] Deleting an item that's on an active occasion shows a warning before proceeding.
- [ ] Purchased items show a "Claimed" badge and remain visible on the list.

---

## Future Improvements
- Item priorities/tags (so a receiver can mark "need soon" vs "someday").
- Price-drop alerts for external items (periodic re-scrape).
- Import from Amazon/Jumia wishlist (bulk import).
- Variant selection for catalog items at add-to-wishlist time.
