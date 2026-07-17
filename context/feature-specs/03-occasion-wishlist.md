# Feature Spec: Occasion Wishlist

**Project:** Gifvtme
**Module:** 02 — Wishlist Core
**Priority:** Core
**Depends on:** Auth flow complete. Supabase migrations 001, 002, 003 running. Evergreen wishlist feature complete.
**Agent instruction:** Implement both UI and backend logic together. Make reasonable implementation decisions where details are unspecified and note assumptions in code comments. Do not ask for clarification.

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
- **Path alias:** `@/` maps to `src/`

---

## Overview

Occasion wishlists are time-bound gifting events — birthdays, weddings, anniversaries, baby showers, graduations. Each occasion has a date, a type, and its own wishlist. The wishlist is populated in two ways: pulling items from the receiver's evergreen list (reusing without duplicating), and adding exclusive items that only appear for this occasion.

This is the "Option C" dual-list model: occasions pull from the evergreen pool AND can have their own exclusive items. When an occasion's date passes and it archives, purchased evergreen-pulled items trigger a reactivation prompt so the receiver can restore them to their main wishlist.

This feature covers:
- Creating an occasion (3-step flow: basic info → pull from evergreen → exclusive items)
- Managing the occasion wishlist (add, edit, delete items)
- Viewing all occasions on the dashboard
- Occasion detail page with two distinct sections
- Auto-archiving elapsed occasions via a cron job
- Reactivation prompt for purchased evergreen items after archiving

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Dashboard (occasions section) | `/wishlists` | Already stubbed — replace stub with real content |
| Create occasion step 1 | `/occasions/new` | Title, type, date |
| Create occasion step 2 | `/occasions/new` (client step) | Pull from evergreen checklist |
| Create occasion step 3 | `/occasions/new` (client step) | Add exclusive items |
| Occasion detail | `/occasions/[id]` | Manage the occasion and its wishlist |

---

## User Flows

### Creating an occasion
```
Dashboard → "Create occasion" button
→ Step 1: Pick occasion type, enter title, pick date → Next
→ Step 2: Select items from evergreen checklist → Next (can skip with 0 selected)
→ Step 3: Add exclusive items → "Create occasion"
→ Redirected to /occasions/[id]
→ Success toast: "Your [type] occasion is ready to share"
```

### Managing an occasion
```
Dashboard → tap occasion card → occasion detail
→ Two sections: "From your wishlist" and "Only for this occasion"
→ Add, edit, delete items in either section
→ Edit occasion title/type/date via three-dot menu
→ Delete (archive) entire occasion via three-dot menu
```

### Auto-archiving
```
Cron runs daily → finds active occasions where occasion_date < today - 7 days
→ Sets status='archived', archived_at=now()
→ For purchased evergreen-pulled items: shows reactivation prompt on next visit
```

---

## Detailed Screen Requirements

### Dashboard Occasions Section (replacing the stub)

**Occasions section on `/wishlists`:**
- Section header "Occasions" + "New occasion" button (ghost, `+` icon, top right)
- Each occasion card:
  - Left: occasion type emoji (large, 32px)
  - Center: occasion title (bold), date formatted as "Sept 8, 2025", item count "12 items"
  - Right: days-remaining pill + "View" button (ghost, small)
  - Days-remaining pill:
    - Future: brand-red background, white text, "14 days to go"
    - Today: "Today! 🎉"
    - Past (active): muted grey, "3 days ago"
    - Archived: grey "Archived" badge
- Sorted: active occasions by date ascending, archived at the bottom
- Empty state: illustration + "No occasions yet — create one for your next big moment" + "Create occasion" CTA button

---

### Create Occasion — Step 1 (Basic Info)

**Route:** `/occasions/new`

**Header:**
- Back arrow → `/wishlists` (confirm dialog if data entered)
- Step indicator: three dots, step 1 active in brand red
- Title: "Create an occasion"
- Subtext: "What are you celebrating?"

**Occasion type grid:**
- 2-column grid of large tappable cards (each ~140px tall on mobile)
- Each card: large emoji centered (36px) + type label below
- Types: 🎂 Birthday | 💍 Wedding | 💑 Anniversary | 👶 Baby Shower | 🎓 Graduation | 🎉 Other
- Selected state: brand-red border + `#FEF2F2` background
- Required — no default

**Occasion title input:**
- Placeholder: "e.g. My 30th Birthday"
- Auto-suggests based on type: Birthday → "My Birthday", Wedding → "Our Wedding" etc.
- Required, max 100 chars

**Date picker:**
- Label: "When is it?"
- Use shadcn/ui `Calendar` or a styled date input
- Date only (no time)
- Past dates allowed with a soft warning toast (not a block)
- Required

**"Next" button** — brand red, pill, full width. Validates all fields before advancing.

---

### Create Occasion — Step 2 (Pull from Evergreen)

**Header:**
- Back arrow → step 1 (preserves step 1 data)
- Step indicator: step 2 active
- Title: "Add from your wishlist"
- Subtext: "Pick things from your main wishlist to include"

**Content:**
- Checklist of all `available` items from the user's evergreen wishlist
- Each row: checkbox + 40px thumbnail + title + price (if set)
- "Select all" / "Clear all" text buttons top right
- Sticky bar at bottom: "X items selected" count
- Empty evergreen state: "Your main wishlist is empty — you can still add items in the next step" + "Skip" button

**"Next" button** — advances to step 3. 0 items selected is allowed.

---

### Create Occasion — Step 3 (Exclusive Items)

**Header:**
- Back arrow → step 2
- Step indicator: step 3 active
- Title: "Add occasion-only items"
- Subtext: "These won't appear on your main wishlist"

**Content:**
- List of exclusive items added so far (initially empty)
- Compact item cards (same style as evergreen detail) with remove button
- "Add item" button (ghost, `+` icon) → opens `AddItemSheet` with `is_exclusive=true`

**Summary sticky bar:**
- "[X] from your wishlist  •  [Y] exclusive items"
- "Create occasion" button (brand red, pill, full width)
- Shows "Creating…" + disabled state while submitting

---

### Occasion Detail (`/occasions/[id]`)

**Header:**
- Back arrow → `/wishlists`
- Occasion title (center, bold)
- Three-dot menu: "Edit occasion" | "Share wishlist" (stub if sharing not built) | "Delete occasion"

**Hero section:**
- Large occasion type emoji (40px)
- Title + date + countdown
- Item count: "[X] items total"

**Section 1: "From your wishlist ([count])"**
- Items with `master_item_id` set (pulled from evergreen)
- Same card style as evergreen detail
- Edit and delete icons on each item
- Deleting removes from this occasion ONLY — never affects the source `master_items` row
- "Add from wishlist" text button at bottom → checklist of remaining evergreen items

**Section 2: "Only for this occasion ([count])"**
- Items with `is_exclusive=true`
- Edit and delete icons
- "Add exclusive item" button → `AddItemSheet` with `is_exclusive=true`

**Archived occasion:**
- "Archived" banner at top (grey, full width)
- No add/edit/delete actions
- If purchased evergreen items exist: show reactivation prompt card

---

### Reactivation Prompt Card (on archived occasions)

Shown at the top of the occasion detail when the occasion is archived and has purchased evergreen-pulled items:

- Title: "These gifts were purchased for your [Occasion]"
- Subtext: "Add them back to your main wishlist for future occasions?"
- List of purchased items (thumbnail + title) each with a toggle: "Keep on my wishlist" (default on)
- "Save" button → calls `/api/occasions/[id]/reactivate`
- Can be dismissed ("Maybe later" — dismisses for the session only, re-shows on next visit)

---

## Backend Requirements

### `POST /api/occasions` — Create occasion

Validates input, then commits rows 1-4 in a single database transaction:
1. Inserts `occasions` row
2. Inserts linked `wishlists` row (`type='occasion'`, `occasion_id` set)
3. For each `pulled_item_id`: fetches the `master_items` row and inserts a `wishlist_items` row with `master_item_id` set, `is_exclusive=false`
4. For each exclusive item: inserts a `wishlist_items` row with `is_exclusive=true`, `master_item_id=null`

If any insert in rows 1-4 fails, the whole transaction rolls back and no partial occasion, wishlist, or item rows remain. After the transaction succeeds, commit those rows before invoking reminder scheduling. Reminder scheduling remains non-blocking: if `occasion_date` is in the future, schedule reminders in a try/catch after the transaction, log failures, and still return `{ occasion_id, wishlist_id }` from the committed transaction.

**Validation schema:**
```typescript
const CreateOccasionSchema = z.object({
  title: z.string().min(1, 'Give your occasion a name').max(100),
  occasion_type: z.enum(['birthday','wedding','anniversary','baby_shower','graduation','other']),
  occasion_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a date')
    .refine(value => parseDateOnly(value) !== null, 'Select a date')
    .refine(value => !isPastDateOnly(value), 'This date has passed')
    .refine(value => !isMoreThanFiveYearsAway(value), "Date can't be more than 5 years in the future"),
  pulled_item_ids: z.array(z.string().uuid()).default([]),
  exclusive_items: z.array(ExternalItemSchema).default([])
})
```

Invalid `pulled_item_ids` (items not owned by the user) are silently skipped — do not fail the whole request.

### Reminder scheduling

On occasion creation with a future date, create `reminders` rows for the receiver:

```typescript
// lib/reminders/scheduleOccasionReminders.ts
const windows = [14, 3] // days before occasion
const channels = ['email', 'push']

const reminders = windows.flatMap(days =>
  channels.map(channel => ({
    user_id: userId,
    occasion_id: occasionId,
    reminder_type: 'occasion_owner',
    channel,
    scheduled_at: subDays(new Date(occasionDate), days).toISOString(),
    sent: false
  }))
).filter(r => new Date(r.scheduled_at) > new Date()) // only future windows

await supabase.from('reminders').insert(reminders)
```

Reminder scheduling failure must NOT block occasion creation — wrap in try/catch, log the error, return success.

### `PATCH /api/occasions/[id]` — Update

Updates `occasions` row. If the title changes, updates the linked occasion `wishlists.title` in the same database transaction and rolls back both rows if either update fails. If `occasion_date` changes: delete unsent reminders for this user with `reminder_type='occasion_owner'` and this `occasion_id`, then reschedule with the new date.

### `DELETE /api/occasions/[id]` — Archive

Soft delete: sets `status='archived'`, `archived_at=now()`. Does NOT delete any wishlist or item rows. Deletes unsent reminders for this user with `reminder_type='occasion_owner'` and this `occasion_id`.

### `POST /api/occasions/[id]/reactivate` — Reactivation

```typescript
// Body: { item_ids: string[] } — array of master_items IDs to reactivate
const { data: wishlist } = await supabase
  .from('wishlists')
  .select('id')
  .eq('user_id', userId)
  .eq('type', 'occasion')
  .eq('occasion_id', occasionId)
  .maybeSingle()

const { data: candidates } = await supabase
  .from('wishlist_items_with_status')
  .select('master_item_id')
  .eq('wishlist_id', wishlist.id)
  .eq('status', 'purchased')
  .eq('is_exclusive', false)
  .in('master_item_id', body.item_ids)

const eligibleMasterItemIds = candidates
  .map(item => item.master_item_id)
  .filter(Boolean)

await supabase
  .from('master_items')
  .update({ status: 'available' })
  .eq('user_id', userId)
  .eq('status', 'purchased')
  .in('id', eligibleMasterItemIds)
```

### `POST /api/occasions/archive` — Cron auto-archive

Cron-protected (same pattern as `/api/reminders`). Finds active occasions where `occasion_date < today - 7 days` and sets them to `archived`.

---

## File Structure

```
src/
  app/
    (dashboard)/
      occasions/
        new/
          page.tsx              ← Multi-step creation (client component)
        [id]/
          page.tsx              ← Occasion detail (server component)
    api/
      occasions/
        route.ts                ← GET, POST
        archive/
          route.ts              ← POST (cron)
        [id]/
          route.ts              ← GET, PATCH, DELETE
          reactivate/
            route.ts            ← POST
  components/
    occasion/
      OccasionCard.tsx          ← Dashboard card
      OccasionHero.tsx          ← Detail page header section
      OccasionTypeSelector.tsx  ← Step 1 grid
      PullFromEvergreen.tsx     ← Step 2 checklist
      ReactivationPrompt.tsx    ← Post-archive UI
      CreateOccasionStepper.tsx ← Step progress indicator
  lib/
    reminders/
      scheduleOccasionReminders.ts
```

---

## Occasion Type Emojis

```typescript
export const OCCASION_EMOJIS: Record<string, string> = {
  birthday: '🎂',
  wedding: '💍',
  anniversary: '💑',
  baby_shower: '👶',
  graduation: '🎓',
  other: '🎉'
}
```

---

## GSAP Animations

| Element | Animation |
|---|---|
| Step 1→2→3 transitions | Slide current out left, new in from right (0.3s, power2.inOut) |
| Occasion cards entrance | `stagger: 0.08, y: 20, opacity: 0, duration: 0.3` |
| Type card selection | Subtle scale pulse: `scale: 0.96, duration: 0.1, yoyo: true, repeat: 1` |
| Reactivation prompt entrance | `height: 0 → auto, opacity: 0 → 1, duration: 0.4` |

---

## Error Handling

| Scenario | Handling |
|---|---|
| No type selected | Field error: "Select an occasion type" |
| No date selected | Field error: "Select a date" |
| Impossible calendar date | Field error: "Select a date" |
| Date in the past | Field error: "This date has passed" |
| Date > 5 years away | Field error: "Date can't be more than 5 years in the future" |
| Creation fails | Toast: "Couldn't create occasion. Try again." |
| Occasion not found | `notFound()` → 404 |
| Wrong user | `notFound()` → 404 |
| Reminder scheduling fails | Log only — creation still succeeds |

---

## Acceptance Criteria

- [ ] A user can create an occasion in 3 steps and the correct DB rows are created
- [ ] Pulled items have `master_item_id` set and `is_exclusive=false`
- [ ] Exclusive items have `is_exclusive=true` and `master_item_id=null`
- [ ] The occasion appears on the dashboard sorted by date ascending
- [ ] Days-remaining displays correctly for future, today, and past dates
- [ ] Editing occasion date cancels unsent reminders and reschedules
- [ ] Deleting an occasion item from "From your wishlist" does NOT affect the `master_items` row
- [ ] The auto-archive cron correctly archives occasions 7+ days past their date
- [ ] Reactivation prompt appears for purchased evergreen-pulled items on archived occasions
- [ ] Reminder failures do not prevent occasion creation
- [ ] No other user can access another user's occasions

---

## What This Feature Does NOT Include

- Sharing the occasion with givers — comes in the Sharing & Giver Flow spec
- Invite-based reminder opt-in (Flow 2) — comes in the Sharing & Giver Flow spec
- Group gifting — explicitly deferred to v2, the toggle shown in the UI is display-only only
