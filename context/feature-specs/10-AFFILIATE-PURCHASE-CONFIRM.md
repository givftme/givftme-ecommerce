# Feature: Affiliate Redirect & Purchase Confirmation

> **Status note (2026-07-31):** This feature was already shipped under migration 006 ("sharing and giver flow"), and the surrounding code (`GiverItemActions.tsx`, `PurchaseConfirmationClient.tsx`, `GiftClaimedSuccess.tsx`, the confirm/success routes) had already been reconciled once today against `09-ITEM-DETAIL-GIVER.md`. This pass audited that same code against *this* spec specifically. Per [[feedback-spec-vs-architecture-precedence]], cosmetic-only divergences (button copy, card layout, back-link style, screen structure, analytics event naming) were left as shipped rather than rewritten to match this file's wording — they're already precedented as intentional. Three real gaps were fixed this pass: (1) no analytics event fired when the confirm screen loaded — added `purchase.external.confirm_screen_viewed`; (2) `POST /api/purchases` collapsed "item not found" and "item already purchased" into a single 404, so a stale page load followed by a confirm tap surfaced a generic "no longer available" error instead of the friendlier, already-handled-client-side "someone else just claimed this" race message — split into 404 (not found/archived) vs 409 (already purchased); (3) the success screen had no item image/title and no celebration animation — added a small confirmatory item preview and a brief GSAP sparkle burst on mount. This file documents shipped reality, not a build target.

## Overview
The complete external-item transaction flow. A giver is redirected to the retailer via an affiliate-tracked URL, completes the purchase externally, then returns to Gifvtme to confirm. On confirmation, a `purchases` row is created, the item is marked as claimed, and an automated thank-you is queued. Since Gifvtme cannot verify the external purchase, this flow depends on the giver's self-reported confirmation.

---

## Goals
- Redirect givers to the correct retailer page with affiliate tracking applied.
- Create an auditable `purchases` record when the giver confirms.
- Mark the wishlist item as claimed atomically (via the `on_purchase_created` DB trigger).
- Queue the automated thank-you message immediately on purchase creation.
- Handle the race condition where two givers attempt to claim the same item.

---

## User Stories
- As a giver, clicking "Buy this gift" takes me to the correct product page on the retailer's site.
- As a giver, after completing my purchase on the retailer's site, I return to Gifvtme to confirm.
- As a giver, if I didn't complete the purchase (changed my mind), I can say so and the item stays available.
- As a receiver, once a giver confirms, the item shows as "Claimed" and I receive an automated thank-you trigger.

---

## Functional Requirements
1. The "Buy this gift" button (`components/wishlist/GiverItemActions.tsx`) opens `wishlist_items.affiliate_url` (falling back to `product_url` with UTM params) in a new tab via `window.open(..., "_blank", "noopener,noreferrer")`.
2. After clicking, the item detail page shows a static inline panel: "Once you've bought it on {domain}, come back and confirm below." with a single "I bought it" link — no separate dismiss/"No, not yet" control, and no slide-in animation (documented and accepted in `09-ITEM-DETAIL-GIVER.md`).
3. "I bought it" routes to the dedicated confirmation screen rather than confirming inline, matching this spec's original design decision.
4. Route: `/w/[id]/confirm/[itemId]` (`app/w/[id]/confirm/[itemId]/page.tsx`). 404s unless the item exists, `origin === "external"`, and `status !== "purchased"`.
5. Confirmation screen (`PurchaseConfirmationClient.tsx`) shows: item image + title + "From {domain}" + a "From {receiverName}'s wishlist" badge, the question "Did you complete your purchase on {domain}?" (relocated here from the item-detail inline prompt), "Yes, I bought it" (filled) CTA, "No, I changed my mind" (ghost) CTA.
6. On confirmation ("Yes, I bought it"):
   - `POST /api/purchases` → creates a `purchases` row.
   - The `on_purchase_created` trigger (see Database Changes — not present as SQL in this repo, but assumed live in Supabase per `context/architecture/DATABASE_SCHEMA.md`) marks `wishlist_items.status = 'purchased'`, marks `master_items.status = 'purchased'` (if `master_item_id` is set), creates a `thank_you_messages` row with `type='auto'`.
   - On success: navigate to `/w/[id]/success/[itemId]`.
7. "No, I changed my mind" → returns to `/w/[id]`. Item remains available.
8. If the item was already purchased by the time the giver confirms (race condition): the API now returns 409 in both the read-time check and the insert-time unique-constraint case (previously only the latter), and the client shows an amber "Someone just claimed this - they got there first!" inline message, then redirects back to the wishlist after ~1.8s.

---

## Non-Functional Requirements
- The purchase POST is idempotent — the DB's `one_purchase_per_item` unique constraint (per `context/architecture/DATABASE_SCHEMA.md`) means a double-tap either no-ops into the same 409 path or the second request loses the race; only one `purchases` row is ever created.
- The confirmation screen has no mobile-specific code path — it uses the same responsive layout as the rest of the app, which is mobile-first throughout.

---

## UI Requirements

### Item detail page — inline confirmation prompt
Shipped as a static panel below "Buy this gift" after it's clicked (no animation, no dismiss control):
```text
"Once you've bought it on {domain}, come back and confirm below."
[I bought it — link to /w/[id]/confirm/[itemId]]
```

### Route: `/w/[id]/confirm/[itemId]`

**Header:** icon-only back arrow to the item detail page (`app/w/[id]/confirm/[itemId]/page.tsx:36-46`), with centered "Confirm" label — not a "← Back to wishlist" text link.

**Card:**
- Item image (56px × 56px, rounded-xl) — not the originally spec'd 160×160px
- Title (`h1`)
- "From {domain}" caption, price if visible
- "From {receiverName}'s wishlist" badge

**Prompt:** "Did you complete your purchase on {domain}?" heading + reassurance copy about payment details staying with the retailer.

**Actions:**
- "Yes, I bought it" (filled button, full width)
- "No, I changed my mind" (ghost button, not a text link)

**Loading state on confirm:** Button shows "Confirming..." + spinner, disabled.

**Race message:** an inline amber banner shown if the API returns 409, auto-redirecting to the wishlist after ~1.8s.

### Route: `/w/[id]/success/[itemId]` — Claimed success screen

**Celebration state:**
- Icon pop-in (GSAP `back.out` ease) on a `CheckCircle` icon, plus a brief (~1.5s) GSAP sparkle burst — 8 sparkle glyphs animating outward from the icon and fading out. *(Added this pass — previously only the icon pop-in existed, no celebration animation.)*
- "Gift claimed! 🎉" heading
- "You've claimed {item.title} for {receiverName}'s {occasion}. {receiverName} will be notified and will send you a thank you." sub-copy
- Small confirmatory item preview (image + title) below the heading. *(Added this pass — previously the item wasn't shown at all on this screen.)*

**Reminder opt-in section** (shown when the wishlist has an occasion date with a "days to go" copy available):
- "Get a reminder before {receiverName}'s {occasion}" heading, "Yes, remind me" / "No thanks" — saves the opt-in via the invite/reminder opt-in API.

**Back CTA:** "View {receiverName}'s full wishlist" → navigates back to `/w/[id]`.

---

## Backend Logic

### `POST /api/purchases` (`app/api/purchases/route.ts`)
```typescript
// 1. Auth check — must be authenticated (Business Rule #2). 401 if missing.
// 2. Validate body against purchaseConfirmationSchema — { wishlist_item_id: uuid }.

// 3. Verify item exists and is accessible.
const { data: item } = await supabase
  .from("wishlist_items_with_status")
  .select("id, origin, status")
  .eq("id", parsed.data.wishlist_item_id)
  .maybeSingle();

if (!item || item.status === "archived") return 404 // "This item doesn't exist or was removed."
if (item.status === "purchased") return 409 // "Someone just claimed this - they got there first!"
if (item.origin !== "external") return 400 // "Catalog gifts go through checkout." (origin-split guard, not in original spec — enforces Business Rules #4-6)

// 4. Insert purchase record.
const { data: purchase, error } = await supabase
  .from("purchases")
  .insert({ wishlist_item_id: item.id, buyer_id: user.id })
  .select("id, wishlist_item_id")
  .single();

if (error?.code === "23505") return 409 // unique constraint race — same message as above
if (error) return 500

// The on_purchase_created trigger (live in Supabase, no SQL source in this repo — see Database Changes) handles:
//   - UPDATE wishlist_items SET status='purchased' WHERE id=$wishlist_item_id
//   - UPDATE master_items SET status='purchased' WHERE id=wishlist_items.master_item_id (if set)
//   - INSERT INTO thank_you_messages (purchase_id, wishlist_item_id, type='auto', message=receiver.default_thank_you_msg)

return 201 { purchase: { id, wishlist_item_id } } // not the full row — buyer_id/created_at aren't selected back
```

Error responses are `{ error: string }` (a human-readable sentence via `lib/api/response.ts`'s `jsonError`), not the originally spec'd `{ error: 'already_purchased', message: string }` machine-readable code — matches this codebase's existing error-response convention everywhere else, and no client code depends on a code token (the client branches on HTTP status only).

### `on_purchase_created` trigger
No SQL source for this trigger (or the `purchases` table, `one_purchase_per_item` constraint, or `thank_you_messages` table) exists anywhere in this repo's migration files — every migration from `003` onward already assumes `purchases` exists. `context/architecture/DATABASE_SCHEMA.md` documents the expected shape and behavior, but the base schema was evidently applied to Supabase directly, outside version control, before this repo's migration numbering started. **Open gap, not fixed this pass** (see Future Improvements) — the app behaves as if the trigger exists as documented, but this can't be independently verified from the repo alone.

---

## Database Changes
No new tables added by this feature. Uses `purchases`, `wishlist_items`, `master_items`, `thank_you_messages` — all assumed pre-existing (see the SQL-source-of-truth gap above).

**`purchases` table schema** (per `context/architecture/DATABASE_SCHEMA.md`, not independently verifiable from this repo's SQL files):
```sql
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id UUID NOT NULL REFERENCES wishlist_items(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_purchase_per_item UNIQUE (wishlist_item_id)
);
```

---

## API Endpoints

### `POST /api/purchases`
**Auth:** required.
**Body:** `{ wishlist_item_id: string }`
**Success (201):** `{ purchase: { id: string, wishlist_item_id: string } }`
**Already purchased (409):** `{ error: "Someone just claimed this - they got there first!" }`
**Not found (404):** `{ error: "This item doesn't exist or was removed." }`
**Wrong origin (400):** `{ error: "Catalog gifts go through checkout." }`

See `context/architecture/API_ROUTES.md` for the canonical, kept-current version of this entry.

---

## Permissions and Authorization
- `POST /api/purchases`: any authenticated user can mark an accessible (per wishlist visibility) item as purchased.
- RLS on `purchases`: buyer can see their own purchase records. Wishlist owner can see purchases on their items. Others have no access. (Not independently re-verified this pass — matches `DATABASE_SCHEMA.md`.)

---

## Validation

```typescript
// lib/wishlist/validation.ts — named purchaseConfirmationSchema, not purchaseSchema
const purchaseConfirmationSchema = z.object({
  wishlist_item_id: z.string().uuid(),
})
```

---

## Error Handling

| Scenario | User-facing message |
|---|---|
| Item already purchased (race condition, or stale-page confirm) | "Someone just claimed this - they got there first!" — 409, inline amber banner, redirects to wishlist after ~1.8s |
| Item not found or archived | "This item doesn't exist or was removed." — 404 |
| Item is a catalog item, not external | "Catalog gifts go through checkout." — 400 |
| Not authenticated | `AuthGateSheet` opens inline (client-side) with a redirect back to the confirm page; server also returns 401 |
| Network/unexpected error on confirm | Toast: "Couldn't confirm. Try again." (idempotent — retry is safe) |

---

## Loading and Empty States
- "Yes, I bought it" button: spinner + "Confirming..." while the POST is in flight.
- Success screen: GSAP icon pop-in + sparkle burst plays once on mount (~1.5s total).

---

## Edge Cases

1. **Two givers submit the confirm at the exact same millisecond.** The `UNIQUE (wishlist_item_id)` constraint ensures only one succeeds; the second now correctly gets 409 either from the pre-check or the constraint violation. Intended behavior, matches spec.

2. **Giver confirms a purchase they didn't actually complete.** Unchanged from the spec — accepted limitation of the affiliate model, no system-level remedy.

3. **Giver returns to confirm days later.** Works — the confirm page re-checks item status server-side on every load (`getSharedWishlistItem` + the 404 guard in `page.tsx`), and `/api/purchases` re-checks again at confirm time.

4. **Giver accidentally closes the confirmation tab.** Unchanged — no expiry, no cleanup needed, re-navigable via the shared wishlist.

5. **Giver confirms, purchase is saved, but the thank-you trigger fails.** Unchanged from spec's stated risk — the trigger (if it matches `DATABASE_SCHEMA.md`) runs in the same transaction as the INSERT, so a trigger bug would block all purchases. Worth revisiting once the trigger has an SQL source of truth in this repo.

6. **Item with `is_exclusive=true` confirmed as purchased.** Unchanged from spec — `master_item_id` is null, so the trigger's conditional `master_items` UPDATE affects 0 rows, no error.

---

## Analytics / Events
Shipped event names differ from this spec's `purchase.*` proposal — they follow the `purchase.external.*` convention already established elsewhere in this codebase (see `09-ITEM-DETAIL-GIVER.md`):
- `purchase.external.redirect` — buy button clicked (`GiverItemActions.tsx`)
- `shared_wishlist.item.buy_tapped` — same click, item-detail-page-scoped event
- `purchase.external.confirm_screen_viewed` — confirm screen mounted *(added this pass — previously missing entirely)*
- `purchase.external.confirmed` — purchase POST succeeded
- `purchase.external.declined` — "No, I changed my mind" clicked
- `purchase.external.race_condition` — 409 received on confirm

---

## Testing Requirements

### Unit tests
- `purchaseConfirmationSchema` validation — not covered by a dedicated test file; validated indirectly via the route.
- `on_purchase_created` trigger — cannot be unit tested from this repo (no SQL source, no DB access from this environment).

### Integration tests
Not present for `/api/purchases` or the confirm/success flow — flagged as a gap in `09-ITEM-DETAIL-GIVER.md` already, not closed this pass (would need Supabase test doubles beyond this session's scope).

### Manual QA
- Click "Buy this gift" from the item detail page — verify it opens in a new tab and the inline confirm panel appears.
- Navigate to `/w/[id]/confirm/[itemId]` directly — verify the correct item is shown.
- Click "Yes, I bought it" — verify: purchase row in DB, item shows "Claimed" on the shared wishlist, thank_you_messages row created, success screen shows the item preview and sparkle animation.
- Open the same confirm page in two browsers and click "Yes, I bought it" in both quickly — verify only one purchase is created and the second sees the 409 race message.
- Load the confirm page, have another browser purchase the item, then click "Yes, I bought it" on the stale page — verify the 409 race message shows (not a generic "no longer available" 404).

---

## Acceptance Criteria
- [x] "Buy this gift" opens the affiliate URL in a new tab and shows the inline confirm panel.
- [x] The confirm screen shows the correct item details.
- [x] "Yes, I bought it" creates a `purchases` row, marks the item as purchased, and triggers the thank-you message — atomically (per the DB trigger, unverified SQL source notwithstanding).
- [x] The race condition (two simultaneous confirms, or a stale-page confirm) results in exactly one purchase and a graceful 409 error for the loser.
- [x] "No, I changed my mind" returns to the item detail page with the item still showing as available.
- [x] Success screen shows a celebration animation and the reminder opt-in section.

---

## Future Improvements
- Locate or reconstruct the original `purchases`/`thank_you_messages`/`on_purchase_created` schema and commit it as a migration, so this repo has a real SQL source of truth instead of relying on `DATABASE_SCHEMA.md`'s description of live Supabase state.
- Automatic purchase detection via Flutterwave or retailer webhooks (eliminating the self-report step).
- "Gifting note" — let givers attach a personal message at purchase time.
- Purchase receipt upload (optional proof of purchase for high-value items).
- Integration test coverage for `/api/purchases` and the confirm/success flow.
