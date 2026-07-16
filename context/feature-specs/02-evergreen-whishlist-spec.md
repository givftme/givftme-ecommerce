# Feature Spec: Evergreen Wishlist

**Project:** Gifvtme
**Module:** 02 — Wishlist Core
**Priority:** Core
**Depends on:** Auth flow must be complete and working. Supabase migrations 001 and 002 must be running.
**Agent instruction:** Implement both the UI and the backend logic together. Use the tech stack defined below. Make reasonable implementation decisions where details are unspecified and note assumptions in code comments. Do not ask for clarification.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components by default)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Icons:** lucide-react
- **Forms:** react-hook-form + Zod
- **Animation:** GSAP + @gsap/react
- **Database:** Supabase (PostgreSQL with RLS)
- **URL scraping:** Microlink API (`/api/scrape` already built)
- **Path alias:** `@/` maps to `src/`

---

## Overview

Every receiver on Gifvtme has exactly one permanent, year-round wishlist called the **evergreen wishlist**. It is the foundation of the entire product — occasion-specific wishlists pull from it, givers browse it, and the receiver manages it over time.

The evergreen wishlist is automatically created the first time a user visits their dashboard. It never expires. Items stay until the receiver removes them or they are marked purchased after a gift is confirmed.

This feature covers:
- Auto-creation of the evergreen wishlist on first dashboard visit
- Viewing and managing the wishlist (add, edit, delete, reorder items)
- Adding items from external URLs (via Microlink scraping) with a manual fallback
- Adding items manually (title, image, price, description)
- Viewing purchase status (who bought what — visible only to the receiver)

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Dashboard home | `/dashboard/wishlists` | Lists the evergreen wishlist card plus occasion wishlists |
| Wishlist detail | `/dashboard/wishlists/[id]` | Full item list with edit/delete/reorder |
| Add item (sheet) | Opens as a bottom sheet over the detail page | URL entry or manual form |
| Edit item (sheet) | Opens as a bottom sheet over the detail page | Edit existing item fields |

---

## User Flows

### First visit
```
User logs in → navigates to /dashboard/wishlists
→ System checks: does this user have an evergreen wishlist?
→ No → auto-create one (title: "My Wishlist", visibility: "private")
→ Redirect to /dashboard/wishlists/[new-id]
→ Show empty state with "Add your first wish" CTA
```

### Adding an item via URL
```
User taps "Add item" → bottom sheet opens
→ URL input shown → user pastes URL
→ System calls /api/scrape
→ Success: scraped preview shown (image, title, price) — all editable
→ User confirms → item saved to wishlist
→ Failure: form switches to manual entry mode
```

### Adding an item manually
```
User taps "Add item" → bottom sheet opens
→ User taps "Add manually instead"
→ Manual form shown (title, image upload, price, description)
→ User fills in → saves → item appears in list
```

### Editing an item
```
User taps edit icon on an item → bottom sheet opens pre-filled
→ User edits fields → saves → list updates
```

### Removing an item
```
User taps delete icon → confirmation dialog
→ Confirms → item archived (soft delete, status = 'archived')
→ Item disappears from the list
```

### Reordering items
```
User long-presses an item (mobile) or drags the handle (desktop)
→ Drags to new position → releases
→ New order saved to Supabase
```

---

## Detailed Screen Requirements

### Screen 1 — Dashboard Wishlists (`/dashboard/wishlists`)

**Layout:** Full screen with dashboard navigation. Single column on mobile, can be wider on desktop.

**Header:**
- Page title: "My Wishlists"
- "Create occasion" button (top right, ghost style) — links to `/dashboard/occasions/new` (stub — just the link for now, that feature comes later)

**Evergreen wishlist card:**
- Large card taking the full width
- Label chip: "Always on" or "Evergreen" (small muted badge)
- Title: "My Wishlist" (editable — tapping the title opens an inline edit)
- Item count: "X items" below the title
- Two CTAs side by side:
  - "View wishlist" (filled, brand red) → navigates to `/dashboard/wishlists/[id]`
  - "Share" (ghost) → opens the share sheet (stub for now — the sharing feature comes later; just show a toast "Sharing coming soon")
- If 0 items: show a soft prompt inside the card "Add things you'd love to receive"

**Occasion wishlists section:**
- Section header: "Occasions"
- Empty state: "No occasions yet — create one to get started." with a "Create occasion" link
- Occasion cards will appear here once that feature is built — for now just show the empty state

**Bottom navigation:**
- Use the `MobileBottomNav` component (already built) — Home, Wishlist (active), Account

---

### Screen 2 — Wishlist Detail (`/dashboard/wishlists/[id]`)

**Layout:** Full screen. Single column on mobile.

**Header:**
- Back arrow → `/dashboard/wishlists`
- Wishlist title (center, editable inline on tap)
- Three-dot menu (top right) with options:
  - "Share wishlist" (stub — toast for now)
  - "Wishlist settings" (stub — links to visibility settings, coming later)

**Toolbar below header:**
- Item count: "X items"
- "Add item" button (brand red, pill, with `+` icon) — opens the add item bottom sheet

**Item list:**
Each item card:
- Product thumbnail (square, `rounded-xl`, 64px × 64px on mobile)
- If no image: grey placeholder with a gift icon (`Gift` from lucide-react)
- Title (truncated at 2 lines, font-medium)
- Price (formatted as ₦X,XXX using `formatPrice()` from `lib/utils.ts`) — shown as "Price not listed" if null
- Source domain (small muted text, e.g. "jumia.com") — only for external items
- "Gifvtme store" badge (brand-light background, brand-red text) — only for catalog items
- Status badge:
  - `available`: no badge (default, no visual indicator needed)
  - `purchased`: "Gifted ✓" badge (green background, green text) + "by [buyer full name]" in small muted text below — **this buyer info is private, only shown to the wishlist owner**
  - `archived`: not shown in the list (filtered out)
- Edit icon (pencil, lucide-react `Pencil`, 16px) — right side
- Delete icon (trash, lucide-react `Trash2`, 16px) — right side
- Drag handle (lucide-react `GripVertical`, 16px, muted) — leftmost, only shown when reorder mode is active

**Reorder toggle:**
- Small "Reorder" text button in the toolbar
- When active: drag handles appear on each item, toolbar shows "Done" button
- When done: new order is saved

**Purchased items section:**
- Purchased items are shown in a separate section below available items
- Section header: "Already gifted ([count])"
- Cards are visually muted (50% opacity)
- No edit or delete icons on purchased items

**Empty state:**
- Centered illustration (large `Gift` icon, 80px, muted color)
- Headline: "Nothing on your list yet"
- Subtext: "Add things you'd love to receive — from any website or the Gifvtme store"
- CTA button: "Add your first wish" (brand red, pill)

---

### Screen 3 — Add Item (Bottom Sheet)

**Opens as:** A `Sheet` component from shadcn/ui, sliding up from the bottom on mobile. A centered `Dialog` on desktop.

**Initial state — URL entry:**

- Sheet title: "Add to wishlist"
- Large URL input field:
  - Placeholder: "Paste a product link from any website"
  - Input type: `url`
  - Paste icon button (lucide-react `Clipboard`) inside the input on the right — tapping it pastes from clipboard
- "Fetch item" button (brand red, pill, full width) — calls `/api/scrape`
- Loading state: button shows `Loader2` spinner + "Fetching…", input disabled
- Divider: "or"
- "Add manually instead" text button (muted, underlined) — switches to manual form

**After successful scrape — Preview state:**

- Small "Edit details" hint text at the top: "We found this — check the details and save."
- Product image (if found):
  - Shown as a square thumbnail (120px × 120px, `rounded-xl`)
  - "Replace photo" link below it — opens file picker
- Editable fields (all pre-filled from scrape, all editable):
  - Title (text input, required)
  - Price (number input, ₦ prefix, optional)
  - Description (textarea, optional, max 500 chars)
- Source URL shown (non-editable, small muted text): "From: jumia.com"
- Currency disclaimer (shown if scraped currency was not NGN):
  - Small amber info box: "Price shown is in [currency] — verify the amount on the original site before saving."
- "Save to wishlist" button (brand red, pill, full width)
- "Start over" text button (muted) — resets to URL entry state

**After scrape failure — Manual form state:**

- Small info banner at top: "We couldn't read that page automatically. Fill in the details below."
- Fields:
  - Title (text input, required)
  - Product URL (pre-filled with the attempted URL, editable — type `url`)
  - Price (number input, ₦ prefix, optional)
  - Image upload area:
    - Dashed border rectangle
    - Upload icon (lucide-react `Upload`) centered
    - "Click here to upload a picture" text
    - On tap: file picker, accepts `image/jpeg, image/png, image/webp`, max 5MB
    - After selection: shows image preview
  - Description (textarea, optional, max 500 chars)
- "Save to wishlist" button (brand red, pill, full width)

**Wishlist selector (if user has active occasions):**
- Shown above the save button
- Label: "Add to:"
- Dropdown or segmented control showing: "My Wishlist" (evergreen) + any active occasion names
- Default: "My Wishlist" selected
- For this feature spec, saving to an occasion is a stub — save to evergreen only, and show a toast "Saving to occasions coming soon" if an occasion is selected

---

### Screen 4 — Edit Item (Bottom Sheet)

**Same sheet as Add Item but pre-filled with existing item data.**

- Sheet title: "Edit item"
- All fields shown in their current state
- "Save changes" button (brand red, pill, full width)
- "Delete item" text button (red, below save) — triggers the delete confirmation

---

## Backend Requirements

### Auto-creation of evergreen wishlist

In the dashboard layout server component (`app/dashboard/layout.tsx`):

```typescript
// After confirming the user is authenticated:
const { data: evergreen } = await supabase
  .from('wishlists')
  .select('id')
  .eq('user_id', userId)
  .eq('type', 'evergreen')
  .maybeSingle()

if (!evergreen) {
  const { data: newWishlist } = await supabase
    .from('wishlists')
    .insert({
      user_id: userId,
      title: 'My Wishlist',
      type: 'evergreen',
      visibility: 'private',
      prices_visible: true
    })
    .select('id')
    .single()

  // Pass the new wishlist ID to the page
}
```

This must run on every dashboard load — it is idempotent (the `one_evergreen_per_user` unique constraint in the DB prevents duplicates even if called twice).

### Fetching the wishlist and items

```typescript
// In /dashboard/wishlists/[id]/page.tsx (server component)
const { data: wishlist } = await supabase
  .from('wishlists')
  .select(`
    id,
    title,
    type,
    visibility,
    prices_visible,
    wishlist_items_with_status (
      id,
      title,
      image_url,
      product_url,
      affiliate_url,
      price,
      origin,
      catalog_product_id,
      status,
      is_exclusive,
      sort_order,
      affiliate_buyer_id,
      affiliate_purchased_at,
      purchase_id,
      order_buyer_id,
      order_id,
      order_status
    )
  `)
  .eq('id', params.id)
  .eq('user_id', userId)  // RLS also enforces this — belt and suspenders
  .single()

if (!wishlist) notFound()
```

Sort items: `sort_order ASC`, then `created_at ASC` as a tiebreaker. Separate into `available` items and `purchased` items client-side.

### Adding an item (API route)

**`POST /api/wishlists/[id]/items`**

This route must handle both `origin='external'` and `origin='catalog'` items. For this feature, only `origin='external'` is used (catalog items come from the gift museum feature later).

```typescript
// Validation
const ExternalItemSchema = z.object({
  origin: z.literal('external'),
  title: z.string().min(1, 'Title is required').max(200),
  product_url: z.string().url('Enter a valid URL'),
  image_url: z.string().url().optional().or(z.literal('')),
  price: z.number().positive().optional(),
  description: z.string().max(500).optional(),
  scraped_currency: z.string().optional()
})

// After validation:
// 1. Build the affiliate URL
import { buildAffiliateUrl } from '@/lib/affiliate/transform'
const { affiliateUrl } = buildAffiliateUrl(body.product_url)

// 2. Insert wishlist_items row
const { data: item } = await supabase
  .from('wishlist_items')
  .insert({
    wishlist_id: params.id,
    origin: 'external',
    title: body.title,
    image_url: body.image_url || null,
    product_url: body.product_url,
    affiliate_url: affiliateUrl,
    price: body.price || null,
    description: body.description || null,
    sort_order: nextSortOrder  // max(sort_order) + 1 for this wishlist
  })
  .select()
  .single()

// 3. If the parent wishlist is type='evergreen', also insert a master_items row
const { data: wishlist } = await supabase
  .from('wishlists')
  .select('type')
  .eq('id', params.id)
  .single()

if (wishlist.type === 'evergreen') {
  await supabase.from('master_items').insert({
    user_id: userId,
    title: body.title,
    image_url: body.image_url || null,
    product_url: body.product_url,
    price: body.price || null,
    origin: 'external',
    sort_order: nextSortOrder
  })
}

return NextResponse.json({ item }, { status: 201 })
```

### Editing an item

**`PATCH /api/wishlists/[id]/items/[itemId]`**

```typescript
const EditItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  image_url: z.string().url().optional().nullable(),
  price: z.number().positive().optional().nullable(),
  description: z.string().max(500).optional().nullable()
})

// Only update fields that were provided
await supabase
  .from('wishlist_items')
  .update(cleanedBody)
  .eq('id', params.itemId)
  .eq('wishlist_id', params.id)
```

### Deleting an item (soft delete)

**`DELETE /api/wishlists/[id]/items/[itemId]`**

```typescript
// Soft delete — set status to 'archived', do not hard delete
// This preserves purchase history if the item was previously purchased
await supabase
  .from('wishlist_items')
  .update({ status: 'archived' })
  .eq('id', params.itemId)
  .eq('wishlist_id', params.id)

return new NextResponse(null, { status: 204 })
```

Do NOT hard delete items. The purchase history relies on the item row existing.

### Reordering items

**`PATCH /api/wishlists/[id]/items/reorder`**

```typescript
const ReorderSchema = z.object({
  ordered_ids: z.array(z.string().uuid())
})

// Update sort_order for each item in the provided order
const updates = body.ordered_ids.map((id, index) => ({
  id,
  sort_order: index
}))

// Supabase doesn't support bulk update natively — use Promise.all
await Promise.all(
  updates.map(({ id, sort_order }) =>
    supabase
      .from('wishlist_items')
      .update({ sort_order })
      .eq('id', id)
      .eq('wishlist_id', params.id)
  )
)
```

### Updating wishlist title

**`PATCH /api/wishlists/[id]`**

```typescript
const WishlistUpdateSchema = z.object({
  title: z.string().min(1).max(100)
})

await supabase
  .from('wishlists')
  .update({ title: body.title })
  .eq('id', params.id)
  .eq('user_id', userId)
```

### Image upload for manual items

Upload to Supabase Storage:
- Bucket: `wishlist-images` (private bucket; public access disabled)
- Path: `[userId]/[uuid].[ext]`
- Store the object path in `image_url`; do not store permanent public URLs.
- When rendering for an authorized wishlist viewer, create a short-lived signed URL server-side and pass that signed URL to the UI. Do not persist signed URLs back to `wishlist_items` or `master_items`.
- Externally accessible image URLs for giver-facing shared wishlists are deferred until wishlist sharing is implemented.

```typescript
let imagePath: string | null = null

const { data, error } = await supabase.storage
  .from('wishlist-images')
  .upload(`${userId}/${crypto.randomUUID()}.${ext}`, file, {
    contentType: file.type,
    upsert: false
  })

if (error || !data?.path) {
  toast({ title: "Couldn't upload photo. Try again.", variant: "danger" })
} else {
  imagePath = data.path
}

// Continue saving the item either way. Persist imagePath when present.
// Later, after authorizing the viewer and only when imagePath exists:
const { data: signed } = imagePath
  ? await supabase.storage
      .from('wishlist-images')
      .createSignedUrl(imagePath, 60 * 60)
  : { data: null }
```

---

## Database Requirements

### Tables used (already exist in migrations)
- `wishlists` — the wishlist record
- `wishlist_items` — individual items
- `master_items` — evergreen pool (mirror of evergreen wishlist items)
- `wishlist_items_with_status` — view that joins purchase data (already created in migration 002)

### Missing column — add to a new migration

The `sort_order` column is not yet in the schema. The agent must create a new migration file `gifvtme_migration_003.sql` with:

```sql
-- Migration 003: Add sort_order to wishlist_items and master_items

ALTER TABLE public.wishlist_items
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.master_items
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX ON public.wishlist_items (wishlist_id, sort_order);
CREATE INDEX ON public.master_items (user_id, sort_order);
```

The agent must also run this migration in Supabase before the reorder feature will work. Add a comment in the reorder route noting this dependency.

### Supabase Storage bucket

Create a bucket named `wishlist-images` with:
- Public access: disabled
- File size limit: 5MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Storage policies must allow authenticated users to upload/read only their own `[userId]/*` folder. Giver-facing signed image access should be added with the wishlist sharing access checks, not before.

The agent should note in a comment that this bucket must be created manually in the Supabase dashboard under Storage, or via the Supabase CLI.

---

## API Endpoints Summary

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/wishlists` | List user's wishlists | Required |
| `POST` | `/api/wishlists` | Create a wishlist (used for auto-creation) | Required |
| `PATCH` | `/api/wishlists/[id]` | Update wishlist title | Required, must own |
| `GET` | `/api/wishlists/[id]/items` | List items (alternative to server component fetch) | Required, must own |
| `POST` | `/api/wishlists/[id]/items` | Add item | Required, must own |
| `PATCH` | `/api/wishlists/[id]/items/[itemId]` | Edit item | Required, must own |
| `DELETE` | `/api/wishlists/[id]/items/[itemId]` | Archive item (soft delete) | Required, must own |
| `PATCH` | `/api/wishlists/[id]/items/reorder` | Update sort order | Required, must own |

All routes must:
1. Check authentication first — return 401 if no session
2. Verify the wishlist belongs to the current user — return 404 if missing or not owned, so the API does not disclose whether another user's wishlist exists
3. Return `{ error: string }` with an appropriate status code on failure

---

## File Structure

```
src/
  app/
    dashboard/
      layout.tsx                    ← Dashboard layout with auto-creation logic + MobileBottomNav
      wishlists/
        page.tsx                    ← Wishlist list page (shows evergreen card + empty occasions)
        [id]/
          page.tsx                  ← Wishlist detail page (server component, fetches items)
    api/
      wishlists/
        route.ts                    ← GET (list), POST (create)
        [id]/
          route.ts                  ← PATCH (update title)
          items/
            route.ts                ← GET (list items), POST (add item)
            reorder/
              route.ts              ← PATCH (reorder)
            [itemId]/
              route.ts              ← PATCH (edit), DELETE (archive)
  components/
    wishlist/
      WishlistCard.tsx              ← Dashboard wishlist summary card
      WishlistItemCard.tsx          ← Individual item row in the detail view
      WishlistItemList.tsx          ← Full item list with sections (available, purchased)
      AddItemSheet.tsx              ← Bottom sheet for adding items (URL + manual)
      EditItemSheet.tsx             ← Bottom sheet for editing items
      EmptyWishlist.tsx             ← Empty state component
      ReorderableList.tsx           ← Drag-to-reorder wrapper
```

---

## Design System Reference

Same as the auth flow spec — use these exact values:

| Token | Value |
|---|---|
| Primary / brand color | `#C50404` |
| Brand hover | `#A80303` |
| Brand light | `#FEF2F2` |
| Secondary text | `#4A4A4A` |
| Surface | `#F7F7F7` |
| Font | Inter |
| Button shape | `rounded-full` (pill) |
| Card shape | `rounded-2xl` |
| Input shape | `rounded-xl` |

**shadcn/ui components to use:**
- `Sheet` — for add/edit item bottom sheet (mobile) and dialog (desktop)
- `Dialog` — confirmation dialogs (delete confirmation)
- `Button`
- `Input`, `Textarea`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`
- `Badge` — for item status indicators
- `Skeleton` — loading states
- `Toast` / `useToast` — success and error notifications

---

## GSAP Animation Requirements

| Element | Animation |
|---|---|
| Item added to list | `gsap.from(newItemCard, { opacity: 0, y: -20, duration: 0.3, ease: 'power2.out' })` |
| Item removed | `gsap.to(itemCard, { opacity: 0, x: -30, height: 0, duration: 0.25, ease: 'power2.in' })` before removal from DOM |
| Sheet open | Handled by shadcn/ui Sheet animation — no GSAP needed |
| Scrape loading → preview | `gsap.from(previewSection, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' })` |
| Empty state entrance | `gsap.from(emptyState, { opacity: 0, scale: 0.95, duration: 0.4, ease: 'back.out(1.5)' })` |
| Reorder drag | Use a drag library (see below) — no GSAP needed for this |

---

## Drag and Drop for Reorder

Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop reordering. This is the recommended drag library for React/Next.js in 2024.

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Implementation pattern:
- Wrap the item list in `<DndContext>` and `<SortableContext>`
- Each `WishlistItemCard` uses `useSortable` hook
- On drag end: call the reorder API endpoint with the new order of IDs
- Show optimistic UI (update local state immediately before API confirms)

If the agent is not familiar with `@dnd-kit`, it may use a simpler approach: "Move up" and "Move down" buttons on each item that swap positions. This is less polished but acceptable for v1.

---

## Validation Rules

### Add item — external (URL scrape path)
```typescript
const ExternalItemSchema = z.object({
  origin: z.literal('external'),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  product_url: z.string().url('Enter a valid product URL'),
  image_url: z.string().url().optional().or(z.literal('')).or(z.null()),
  price: z.number().positive('Price must be a positive number').optional(),
  description: z.string().max(500, 'Keep description under 500 characters').optional()
})
```

### Add item — manual entry path
Use the same required `product_url` constraint as the external URL path for v1. The current Supabase invariant requires `product_url` whenever `origin = 'external'`, and the API builds `affiliate_url` from it before inserting. A true URL-less manual-entry schema is deferred until the data model explicitly supports wishlist ideas without an affiliate/source URL; that change must update `BUSINESS_RULES.md`, the database check constraints, the add-item API branch, and giver-facing purchase behavior together.

### Edit item
All fields optional — only validate fields that are provided.

### Wishlist title update
```typescript
z.object({ title: z.string().min(1, 'Title cannot be empty').max(100) })
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Scrape call fails (Microlink 422) | Switch to manual form, show info banner: "Couldn't read that page automatically. Fill in the details below." |
| Scrape call times out (3.5 seconds, always under 4 seconds) | Same as failure — switch to manual form immediately |
| Image upload fails | Toast error: "Couldn't upload photo. Try again." — do not block item save |
| Add item fails (API error) | Toast error: "Couldn't save item. Try again." |
| Edit item fails | Toast error: "Couldn't save changes. Try again." |
| Delete item fails | Toast error: "Couldn't delete item. Try again." |
| Reorder fails | Revert to previous order in the UI, toast: "Couldn't save new order." |
| Wishlist not found | `notFound()` → 404 page |
| User tries to access another user's wishlist | `notFound()` → 404 (do not expose "that exists but isn't yours") |
| API request references another user's wishlist | `{ error: "Wishlist not found." }` → 404 |
| Title empty on save | Inline field error: "Title cannot be empty" |
| URL is not a valid URL | Inline field error: "Enter a valid URL (e.g. https://jumia.com/...)" |

---

## Loading States

| State | Implementation |
|---|---|
| Wishlist detail page loading | Server component — use React Suspense with `<Skeleton>` cards as fallback |
| Item list loading | 3 skeleton item cards (image placeholder + text lines) |
| Scraping in progress | Button shows `Loader2` spinner + "Fetching…", input disabled |
| Adding item | Sheet save button shows "Saving…" + disabled state |
| Editing item | Sheet save button shows "Saving…" + disabled state |
| Deleting item | Item card shows subtle opacity reduction while in flight |
| Reordering | Optimistic — update immediately, revert only on error |

---

## Empty States

| Context | Display |
|---|---|
| Wishlist has no items | Large `Gift` icon (80px, muted), "Nothing on your list yet", "Add your first wish" CTA |
| All items purchased/archived | "Everything on your list has been gifted 🎉" with a celebration tone |
| Scrape returns no results | Switch to manual form automatically |
| No wishlists at all (should never happen after auto-creation) | Show auto-creation loading state then redirect |

---

## Edge Cases the Agent Must Handle

1. **Duplicate URL** — user adds the same URL twice to the same wishlist. Do not block this. Show a warning: "This might already be on your list — [title]. Add it anyway?" with Yes/No options.

2. **Scraping Amazon URLs** — Amazon actively blocks scrapers. Detect `amazon.com` in the URL and skip the Microlink call entirely, going straight to manual form. Add a comment explaining why.

3. **Image URL fails to load** — always provide a fallback in the `<Image>` component: a grey square with a `Gift` icon centered. Never show a broken image.

4. **Price of 0** — treat as "no price" and display as "Price not listed." Never display ₦0.

5. **Very long product titles** — truncate at 2 lines in the list view using CSS `-webkit-line-clamp`. Show the full title in the edit sheet.

6. **User refreshes while reorder is in progress** — the optimistic state will be lost. This is acceptable for v1.

7. **Purchased items that the user tries to delete** — allow archiving purchased items but show a warning: "This item has been gifted — it will be hidden but the purchase record is kept."

8. **`sort_order` migration not run** — if the `sort_order` column doesn't exist, the add item call will fail. The agent should add a try/catch around sort_order-dependent queries and fall back to ordering by `created_at` if the column is missing, with a clear error log.

9. **Auto-creation race condition** — two tabs open simultaneously, both try to create the evergreen wishlist. The `one_evergreen_per_user` unique constraint in the DB will reject the second insert. Catch this error gracefully and redirect to the existing wishlist.

---

## Analytics Events

Track these events using a thin wrapper. If no analytics library is set up yet, log them to the console with `console.log('[analytics]', event, properties)` as a placeholder.

```typescript
// Events to track:
'wishlist.viewed'           // { wishlist_id, item_count }
'wishlist.item.added'       // { origin, has_price, has_image, scraped: boolean }
'wishlist.item.scrape.attempted'  // { domain }
'wishlist.item.scrape.succeeded'  // { domain, has_price, has_image }
'wishlist.item.scrape.failed'     // { domain }
'wishlist.item.edited'      // { wishlist_item_id }
'wishlist.item.deleted'     // { wishlist_item_id }
'wishlist.reordered'        // { item_count }
'wishlist.title.updated'    // {}
```

---

## Permissions and Authorization Summary

- All wishlist routes require authentication.
- A user can only read, write, and delete items on wishlists they own.
- Non-owned wishlist reads and mutations must return 404, not 403, to avoid disclosing resource existence.
- This is enforced at two levels: application code (check `user_id` on every query) AND Supabase RLS (the DB-level policy). Both must be in place.
- Never use the service-role client for customer-facing wishlist operations — always use the regular server client so RLS applies.

---

## Acceptance Criteria

The implementation is complete when all of the following pass:

- [ ] A user who logs in for the first time and visits `/dashboard/wishlists` automatically has an evergreen wishlist created — exactly one, never two
- [ ] The wishlist title is editable inline and the change persists on refresh
- [ ] Adding an item via URL scrape: a valid Jumia or Konga URL populates the title, image, and price in the preview within 4 seconds; any scrape that reaches the 3.5-second timeout falls back to manual entry before the 4-second mark
- [ ] Adding an item via URL scrape: an Amazon URL or any failed scrape immediately switches to the manual form without blocking
- [ ] Adding an item manually: all fields save correctly, image upload stores to Supabase Storage and appears in the list
- [ ] Items appear in the list sorted by `sort_order`, with purchased items in a separate section below
- [ ] Editing an item updates all changed fields and the list reflects the changes without a page reload
- [ ] Deleting an item archives it (status = 'archived') — it disappears from the list but is not hard-deleted from the database
- [ ] Purchased items (status = 'purchased') show with the "Gifted ✓" badge and buyer name, visible only to the wishlist owner
- [ ] Reordering items saves the new sort order and persists on refresh
- [ ] All error states (scrape failure, save failure, delete failure) show appropriate toast messages
- [ ] The empty state shows when the wishlist has no available items
- [ ] No other user can access or modify the wishlist via the API (returns 404 with `{ error: string }`)
- [ ] The `master_items` row is created alongside the `wishlist_items` row for every item added to an evergreen wishlist

---

## What This Feature Does NOT Include

Do not implement these — they come in later feature specs:

- Sharing the wishlist (visibility settings, invite by email) — comes in the Sharing feature
- Pulling items into an occasion — comes in the Occasion Wishlist feature
- Viewing the wishlist as a giver — comes in the Shared Wishlist View feature
- Adding catalog items from the Gifvtme store — comes in the Gift Museum feature
- The occasion wishlist card on the dashboard — stub the section with an empty state only
