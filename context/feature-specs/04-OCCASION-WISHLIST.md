# Feature: Occasion Wishlist

## Overview
Time-bound gifting event wishlists (birthdays, weddings, graduations, etc.) that pull items from the evergreen pool and optionally add exclusive items. This is "Option C" from the product architecture — occasions share from the evergreen pool rather than being fully independent lists. A user can have multiple active occasion wishlists simultaneously. Each occasion has a date, which drives reminders and eventual archiving.

---

## Goals
- Let receivers create dedicated wishlists for specific events.
- Reuse evergreen items to avoid duplicating data and the management burden of maintaining parallel lists.
- Allow occasion-only ("exclusive") items for things only relevant to that event.
- Provide a clear time context (countdown, occasion type) for givers.

---

## User Stories
- As a receiver, I can create a new occasion wishlist with a name, type, and date.
- As a receiver, I can pull items from my evergreen list into an occasion.
- As a receiver, I can add items exclusively to an occasion (not in my evergreen list).
- As a receiver, I can view all my active occasions from a dashboard list.
- As a receiver, I can edit an occasion's details (name, date, type).
- As a receiver, I can see a countdown to my occasion date.
- As a receiver, I receive a reactivation prompt after my occasion passes for purchased evergreen items.

---

## Functional Requirements
1. Creating an occasion creates both an `occasions` row and a linked `wishlists` row (`type='occasion'`, `occasion_id` set).
2. Three-step creation flow: Step 1 (occasion details) → Step 2 (pull from evergreen) → Step 3 (add exclusive items).
3. Pulling an evergreen item creates a new `wishlist_items` row with `master_item_id` set and `is_exclusive=false`. The original evergreen `wishlist_items` row is not modified.
4. Adding an exclusive item creates a `wishlist_items` row with `master_item_id = null` and `is_exclusive=true` — these items are never available on the evergreen list or other occasions.
5. An occasion's date cannot be in the past at creation time (soft UI validation — warn, don't hard block for flexibility on creating "today" occasions).
6. Occasion types: `birthday`, `wedding`, `anniversary`, `graduation`, `baby_shower`, `housewarming`, `christmas`, `other`. This enum should match the Sanity `occasion` document `occasionType` values.
7. Multiple occasions can be active simultaneously — there is no "one occasion at a time" limit.
8. Auto-archiving: 7 days after `occasion_date` passes, a cron job sets `occasions.status = 'archived'` and `archived_at = now()`. A reactivation prompt is generated for purchased evergreen items.
9. Archived occasions are visible in a separate "Past occasions" section of the dashboard, not deleted.
10. Editing an occasion's date reschedules any associated `reminders` rows — existing unsent reminders are deleted and new ones scheduled relative to the new date.

---

## Non-Functional Requirements
- The 3-step creation flow must preserve state if the user navigates back between steps — no data loss on step change.
- Loading the "pull from evergreen" step (Step 2) must show the current evergreen list in under 1 second (fetched from Supabase, not Sanity).

---

## UI Requirements

### Route: `/dashboard/occasions` (list)
- Active occasions grid (cards with occasion type icon, name, date countdown, item count)
- "New occasion" CTA (filled button)
- "Past occasions" collapsible section below active list
- Empty state: "No occasions yet. Create one for your next birthday or special event."

### Route: `/dashboard/occasions/new` (3-step creation)

**Step 1: Occasion details**
- Occasion name (text input, required, placeholder: "My Birthday 2025")
- Occasion type (select/radio — icons for each type)
- Date (date picker)
- "Next" CTA

**Step 2: Add from your wishlist**
- Sub-heading: "Which wishes do you want on this list?"
- Grid of current evergreen items, each with a checkbox
- "Select all" / "Clear all" links
- If evergreen list is empty: "Your evergreen wishlist is empty. You can add items in the next step or skip this." with a CTA to add items to evergreen first
- "Next" CTA (can proceed with 0 items selected)
- "Back" link

**Step 3: Add exclusive items**
- Sub-heading: "Add items only for this occasion"
- Same "Add item" UI as evergreen (URL tab + manual tab)
- List of items added so far in this step
- "Create occasion" CTA (filled, creates the occasion)
- "Back" link
- "Skip" link (if user doesn't want any exclusive items)

**Step indicator:** progress dots or numbered steps at top of the form — "1 · 2 · 3"

### Route: `/dashboard/occasions/[id]` (occasion detail)
- Header: occasion name, type icon, date with countdown ("In 23 days" / "Today!" / "3 days ago")
- Two sections on desktop (tabs on mobile): "Pulled from wishlist" and "Exclusive to this occasion"
- Item cards matching evergreen style — with "Claimed" badges for purchased items
- "Share" CTA (same as evergreen)
- "Edit details" link → opens an edit sheet
- "Add more items" CTA per section

**Edit sheet:**
- Occasion name, type, date — editable
- "Save" CTA — on date change, show a note: "Reminders will be rescheduled to match the new date."
- "Archive now" (destructive action, below a separator)

**Reactivation prompt** (shows after occasion archives):
- Appears as a dashboard notification or an in-app alert banner
- Lists purchased evergreen items: "These items on your wishlist were bought for [Occasion Name]. Do you want them available again?"
- Per-item toggles: reactivate / keep as purchased
- "Save" CTA

---

## Backend Logic

### Create occasion (3-step submit on Step 3 "Create occasion")
```
BEGIN TRANSACTION;

1. INSERT INTO occasions (user_id, title, occasion_type, occasion_date, status='active')
   → returns occasion_id

2. INSERT INTO wishlists (user_id, title, type='occasion', occasion_id, visibility='private')
   → returns wishlist_id

3. For each selected evergreen item (from Step 2):
   INSERT INTO wishlist_items (wishlist_id, master_item_id, title, image_url, price,
     product_url, affiliate_url, origin, catalog_product_id, is_exclusive=false, sort_order)
   — copy all fields from the master_items row

4. For each exclusive item added (from Step 3):
   INSERT INTO wishlist_items (wishlist_id, master_item_id=null, is_exclusive=true, ...)

5. Schedule reminders: call scheduleOwnerReminders equivalent for this occasion's date
   (creates 2 reminder rows: 14-day and 3-day warning to the receiver if they have invitees)

COMMIT;
```

### Auto-archive cron job (`/api/occasions/archive` — new route)
Runs daily. Logic:
```
SELECT id FROM occasions
WHERE status = 'active'
AND occasion_date < CURRENT_DATE - INTERVAL '7 days';

For each:
  UPDATE occasions SET status='archived', archived_at=NOW() WHERE id=$1;
  
  -- Generate reactivation prompts for purchased evergreen items:
  SELECT wi.master_item_id FROM wishlist_items wi
  JOIN wishlists wl ON wl.id = wi.wishlist_id
  WHERE wl.occasion_id = $occasionId
  AND wi.is_exclusive = false
  AND wi.status = 'purchased';
  
  -- Insert a notification/prompt row (needs a notifications or prompts table — see DB changes below)
```

### Edit occasion date → reschedule reminders
```
1. UPDATE occasions SET occasion_date=$newDate, title=$newTitle, occasion_type=$newType WHERE id=$1.
2. DELETE FROM reminders WHERE source_occasion_id=$1 AND sent=false.
   (Requires adding source_occasion_id to reminders — see DB changes)
3. Reschedule: insert new reminder rows for the new date.
```

### Reactivation: restore purchased evergreen items
```
For each item the user toggles to "reactivate":
  UPDATE master_items SET status='active' WHERE id=$masterItemId;
  UPDATE wishlist_items SET status='available' WHERE master_item_id=$masterItemId AND wishlist_id=$evergreenwishlistId;
  -- Also delete the purchase record? No — keep it for history. Just flip the item status.
```

---

## Database Changes

Existing tables used: `occasions`, `wishlists`, `wishlist_items`, `master_items`, `reminders`.

**New: add `source_occasion_id` to `reminders` table (for reschedule-on-edit):**
```sql
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS source_occasion_id UUID REFERENCES occasions(id) ON DELETE CASCADE;
```

**New: `occasion_prompts` table for reactivation prompts:**
```sql
CREATE TABLE occasion_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  occasion_id UUID NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL DEFAULT 'reactivation', -- extensible for future prompt types
  payload JSONB NOT NULL DEFAULT '{}', -- stores list of master_item_ids eligible for reactivation
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX occasion_prompts_user_unresolved_idx ON occasion_prompts(user_id) WHERE resolved_at IS NULL;
```

---

## API Endpoints

### `POST /api/occasions`
Create a new occasion + linked wishlist + items.
**Auth:** required.
**Request body:**
```typescript
{
  title: string,
  occasion_type: OccasionType,
  occasion_date: string, // ISO date
  pulled_item_ids: string[], // master_item_ids to pull from evergreen
  exclusive_items: AddItemPayload[], // same shape as /api/wishlists/[id]/items POST body
}
```
**Response:** `{ occasion: Occasion, wishlist: Wishlist }`.

### `PATCH /api/occasions/[id]`
Edit occasion details.
**Auth:** required (must own the occasion).
**Request body:** partial — `title`, `occasion_type`, `occasion_date`.
**Response:** `{ occasion: Occasion }`.

### `POST /api/occasions/[id]/archive`
Manually archive an occasion (before the 7-day auto-archive).
**Auth:** required (must own).
**Response:** `{ archived: true }`.

### `POST /api/occasions/[id]/reactivate-items`
Resolve the reactivation prompt — restore selected items to available.
**Auth:** required (must own).
**Request body:** `{ reactivate_item_ids: string[] }` (master_item_ids to restore).
**Response:** `{ reactivated: number }`.

### `POST /api/occasions/archive` (cron route)
Protected by `CRON_SECRET` header. Runs daily. Archives overdue occasions.
**Response:** `{ archived: number }`.

---

## Permissions and Authorization
- All occasion CRUD operations: must be the occasion owner (`occasions.user_id = auth.uid()`).
- Occasion's linked wishlist: follows the standard wishlist visibility rules for reads.
- Cron route: protected by `Authorization: Bearer ${CRON_SECRET}` — not user auth.

---

## Validation

```typescript
const createOccasionSchema = z.object({
  title: z.string().min(1, "Occasion name is required").max(100),
  occasion_type: z.enum(['birthday', 'wedding', 'anniversary', 'graduation',
    'baby_shower', 'housewarming', 'christmas', 'other']),
  occasion_date: z.string().refine(d => !isNaN(Date.parse(d)), "Invalid date"),
  pulled_item_ids: z.array(z.string().uuid()).default([]),
  exclusive_items: z.array(addItemSchema).default([]),
})
```

Date warning (not hard block): if `occasion_date` is more than 1 day in the past, show: "This date has already passed — are you sure?"

---

## Error Handling

| Error | User-facing message |
|---|---|
| Create fails (network) | "Couldn't create your occasion. Please try again." |
| Occasion not found | 404 page |
| Edit date to same value | No-op (detect and skip the API call) |
| Archive fails | "Couldn't archive this occasion. Please try again." |
| Reactivation prompt resolve fails | "Couldn't save your choices. Please try again." |

---

## Loading and Empty States

**Occasions list — loading:** 2–3 skeleton occasion cards.
**Occasions list — empty:** "No occasions yet" with illustrated empty state and "Create one" CTA.
**Step 2 (pull from evergreen) — loading:** skeleton grid.
**Step 2 (pull from evergreen) — empty evergreen:** "Your evergreen wishlist is empty" state with CTA.
**Occasion detail — all items purchased:** "Everything on this list has been gifted! 🎉" banner.

---

## Edge Cases

1. **User creates two occasions on the same date.** Allowed — no uniqueness constraint on `occasion_date` per user. Both show the same countdown.

2. **Editing an occasion's date to be in the past.** Warn the user. If they confirm, update. Archiving cron will pick it up within 7 days.

3. **Exclusive item deleted from an occasion.** Since it has no `master_item_id`, it's simply deleted. No evergreen impact.

4. **Pulled item deleted from evergreen while still on an active occasion.** If the delete cascade (`ON DELETE CASCADE` on `wishlist_items.master_item_id`) removes the occasion copy, the occasion silently loses an item. **Recommend showing the warning on evergreen delete (already in the evergreen spec) and considering whether the occasion copy should instead become `is_exclusive=true` (effectively "promoted" to orphaned exclusive) rather than deleted.** This is a design decision not yet made — flag for product review.

5. **User has no evergreen items when creating an occasion.** Step 2 shows the empty-evergreen state with a CTA to add items to evergreen first (opens the evergreen add-item flow in a modal, then returns them to Step 2 of occasion creation). Or they can just skip Step 2.

6. **Occasion archived but user never resolves the reactivation prompt.** The `occasion_prompts` row sits with `resolved_at = null` indefinitely. A dashboard notification badge should nudge the user. After 30 days unresolved, the prompt could be auto-dismissed (all items left as purchased) — **this auto-dismiss behavior is not yet specified, flag as a decision.**

7. **Reschedule reminders when date changes.** The existing reminder rows for this occasion (identified by `source_occasion_id`) that haven't been sent must be deleted and recreated. Already-sent reminders are left as-is (historical record).

---

## Analytics / Events
- `occasion.created` (occasion_type, has_pulled_items: bool, has_exclusive_items: bool)
- `occasion.edited` (fields_changed)
- `occasion.archived` (manual: bool)
- `occasion.reactivation_prompt.shown`
- `occasion.reactivation_prompt.resolved` (items_reactivated: number)

---

## Testing Requirements

### Integration tests
- Create occasion: verify `occasions`, `wishlists`, and correct `wishlist_items` rows all created in one transaction.
- Pull items from evergreen: verify `master_item_id` is set and `is_exclusive=false`.
- Edit date: verify old unsent reminders deleted, new ones created at correct schedule.
- Auto-archive cron: verify occasions 7+ days past their date get archived, on-time occasions do not.
- Reactivation: verify `master_items.status` flips back to `active` for selected items.

### Manual QA
- Create an occasion with 3 evergreen items and 2 exclusive items. Verify all 5 appear on the occasion detail page in the correct sections.
- Edit the occasion date. Verify reminders rescheduled.
- Manually archive an occasion. Verify it moves to "Past occasions" section.
- Trigger the reactivation flow and verify evergreen items correctly toggle status.

---

## Acceptance Criteria
- [ ] Creating an occasion produces an `occasions` row, a `wishlists` row, and the correct `wishlist_items` rows atomically.
- [ ] Pulled items have `master_item_id` set; exclusive items have `master_item_id = null` and `is_exclusive = true`.
- [ ] Editing an occasion's date reschedules unsent reminders.
- [ ] The auto-archive cron archives occasions 7+ days past their date.
- [ ] An archived occasion generates a reactivation prompt for purchased evergreen items.
- [ ] Resolving the reactivation prompt correctly updates `master_items.status` for selected items.

---

## Future Improvements
- Invite-only occasion creation with a co-organizer role (e.g. spouse can both manage a wedding registry).
- Occasion templates (pre-filled item suggestions by occasion type).
- Multiple occasion dates for multi-day events.
- Public occasion pages discoverable via search (for public wishlists).
