# Feature: Shared Wishlist View (Giver Landing Page)

> **Status note (2026-07-30):** This feature was already shipped under migration 006 ("sharing and giver flow") before this file was reconciled — `app/w/[id]/page.tsx`, `SharedWishlistClient.tsx`, `lib/wishlist/shared.ts`. Per [[feedback-spec-vs-architecture-precedence]], the shipped design diverges from this spec's original wording in several places (share key is the wishlist's own `id`, not a `share_token` column; item grid is a horizontal list, not an image-forward card grid; reminder opt-in also allows non-invitee viewers of public wishlists). This pass closed the real gaps: private-vs-not-found differentiation, an archived-occasion page, a custom not-found page, countdown color states, server-side price stripping when `prices_visible=false`, server-side 24-hour intent-flag expiry, archived-catalog-item handling, the footer/CTA, per-filter empty states, the all-claimed banner, and SEO meta tags (`gifvtme_migration_013_shared_wishlist_access.sql` plus `lib/wishlist/shared.ts`, `app/w/[id]/page.tsx`, `app/w/[id]/not-found.tsx`, `SharedWishlistHeader.tsx`, `SharedWishlistClient.tsx`, `SharedWishlistItem.tsx`). Working, differently-shaped code was left as-is — this file documents shipped reality, not a build target.

## Overview
The most critical screen in the product — the page every gift-giver sees when they open a shared wishlist link. Shows the receiver's name, occasion details with a countdown, and the list of gift items with their current availability status. Fully accessible without an account (read-only). Purchasing requires auth.

---

## Goals
- Give givers an immediate, clear picture of what's wanted and what's already claimed.
- Surface the occasion context (countdown, event type) so givers feel the urgency and relevance.
- Make it obvious which items are available vs claimed without confusion.
- Respect the receiver's price-visibility setting.

---

## User Stories
- As a giver, I open a shared link and immediately see whose wishlist it is and what occasion it's for.
- As a giver, I can see all items with their current available/claimed status.
- As a giver, I can filter items (all / available / claimed).
- As a giver with an invite, I can opt into receiving a reminder before the occasion.
- As an unauthenticated giver, I can view the full wishlist but am prompted to sign in when I try to buy.

---

## Functional Requirements
1. Route: `/w/[id]` — `id` resolves as either a `wishlist_invites.token` (friends_family) or the wishlist's own `id` (public). There is no `share_token` column. See `07-WISHLIST-SHARING.md` for the sharing model.
2. If the wishlist is private/restricted or the token is invalid, `gifvtme_get_shared_wishlist()` (migration 013) returns a distinguishable `access` field — `not_found` vs `restricted` — instead of `NULL` for both. `app/w/[id]/page.tsx` renders Next's `not-found.tsx` (custom copy, see Error Handling) for `not_found`, and a "This wishlist is private" notice for `restricted`.
3. If the wishlist's occasion has been auto-archived (`occasions.status = 'archived'`, not `wishlists.status` — wishlists have no status column), the page shows a "This occasion has passed" notice with a link to `/shop`. A merely past-due-but-not-yet-archived occasion is unaffected (see Edge Cases).
4. Item availability comes from `gifvtme_get_shared_wishlist()`, which independently joins `purchases`/`orders` the same way the `wishlist_items_with_status` view does (not a `SELECT` from that view directly — the RPC predates it needing to for anon access reasons).
5. If `prices_visible=false`: `price` is stripped to `null` server-side in `lib/wishlist/shared.ts` before the data ever reaches the client component — not just hidden in the UI. Nothing price-related is present in the page's RSC payload.
6. Reminder opt-in is shown whenever there's an upcoming occasion date (see UI Requirements) — **not** restricted to invitees only, by deliberate design: `POST /api/wishlists/[id]/reminders/opt-in` lets any authenticated viewer of a **public** wishlist opt in, auto-creating a `wishlist_invites` row for them if needed. Invitees with an existing invite use `POST /api/wishlists/[id]/invites/[inviteId]/opt-in` instead. This is intentional, not a gap — do not restrict it to invitees without a product discussion.
7. Server-rendered for performance and SEO — `app/w/[id]/page.tsx` is a Next.js server component (`force-dynamic`), and `generateMetadata` sets per-wishlist title/description. Item status is fetched fresh on each load. The interactive shell (`SharedWishlistClient`) is a client component, so filtering/reminder actions need JS, but the initial content (header, items, prices) renders without it.
8. An intent-flag ("someone's planning to buy this") is shown only when `intent_flagged_at` is within the last 24 hours — enforced twice: query-time in `lib/wishlist/shared.ts` (nulls the field on read if expired, added this pass) and by the `/api/reminders` cron job, which nulls `intent_flagged_by`/`intent_flagged_at` in the DB for rows older than 24h.

---

## Non-Functional Requirements
- Page must be fully rendered (not a loading shell) within 2 seconds for a fresh load. Server render ensures the content is immediately visible without client-side JS execution.
- The page must work with JavaScript disabled (basic read-only view — only interactive features like reminder opt-in require JS).

---

## UI Requirements

### Page structure

**Header (`SharedWishlistHeader.tsx`):**
- Receiver's avatar (circular) + name (h1)
- Occasion type icon + occasion name (if occasion wishlist)
- Countdown chip: colored pill — green if >7 days, amber if ≤7, red if ≤3, "Today!" (red) if same day, "Passed" (muted) if past. Copy is "X days to go" / "1 day to go" / "Today!" / "Passed" (not "In X days").
- Mobile header is shown inline; desktop repeats it in a sticky sidebar alongside the reminder button.

**Reminder opt-in:** shown as a persistent ghost button (sidebar on desktop, fixed bottom bar on mobile) whenever the occasion date is still in the future — not a dismissible one-time banner. "Remind me before [receiver]'s [occasion]" → on click, saves via the appropriate opt-in endpoint (see Functional Requirement 6) and shows a toast; no inline "✓ You'll be reminded" swap.

**Filter pills:**
- "All items" | "Available" | "Claimed", each with a live count.
- Active filter has a solid brand background.

**All-claimed banner:** when every non-archived item is claimed, a "🎁 Everything on this list has been gifted!" banner shows above the grid regardless of which filter is active — the grid itself still renders (or shows the filtered-empty copy if the active filter has no matches).

**Item grid (`SharedWishlistItem.tsx`):**
- Shipped as a 1-column (mobile) / 2-column (desktop) list of horizontal rows, not an image-forward card grid — 64px thumbnail, title, price (if visible), source pill, status.
- Status: "Available" (green pill) + a "Buy this gift" button, or a muted "Claimed" badge (`ClaimedBadge`), or — for a catalog item whose Sanity product has been archived/deleted — a muted "No longer available" badge with no buy action and no detail-page link (checked via a batch Sanity lookup on `catalog_product_id`, added this pass).
- Intent flag: small amber `IntentFlagBadge` under the status pill, only when not claimed/unavailable and the flag hasn't expired.
- Clicking the title navigates to `/w/[id]/item/[itemId]` (out of scope for this file — see the item-detail giver spec).

**Footer:** "Powered by Gifvtme · gifvtme.com" link, shown only for `public` wishlists. "Create your own wishlist" CTA, shown for authenticated viewers who aren't the wishlist owner. Both fire `shared_wishlist.cta_clicked`.

**Empty state (no items):** "[Receiver] hasn't added any wishes yet." — or, if the viewer is the owner (previewing their own wishlist), "Add items to your wishlist".

**Filtered-empty states:** "Available" filter with none available → "All items have been claimed! 🎉". "Claimed" filter with none claimed → "Nothing's been claimed yet — be the first!".

---

## Backend Logic

### Page data fetching (server component)
`app/w/[id]/page.tsx` calls `getSharedWishlist(id)` (`lib/wishlist/shared.ts`, wrapped in React `cache()` so `generateMetadata` and the page component share one fetch per request). That function:
1. Calls the `gifvtme_get_shared_wishlist(p_share_key)` RPC (SECURITY DEFINER), which resolves the token as an invite first, then as the wishlist's own `id`, and returns `{ access: 'ok' | 'not_found' | 'restricted', invite, wishlist }`.
2. On `ok`, normalizes the payload: strips `price` when `!prices_visible`, nulls expired intent flags, auto-accepts a matched invite for a logged-in viewer (`autoAcceptInvite`), signs storage image URLs, then batch-checks `catalog_product_id`s against Sanity (`CART_PRICES_QUERY`) to flag `catalog_unavailable` items.
3. Returns `{ user, wishlist, status }` where `status` is `ok | not_found | restricted | error`.

`app/w/[id]/page.tsx` branches on `status`: `not_found` → `notFound()` (renders `app/w/[id]/not-found.tsx`); `restricted` → private notice; `error` → generic reload notice; `wishlist.occasion?.status === 'archived'` → archived-occasion notice; otherwise renders `SharedWishlistClient`.

### Intent flag expiry
Enforced in `lib/wishlist/shared.ts` at read time (any item's `intent_flagged_at` older than 24h is nulled before reaching the client) and, independently, by the `/api/reminders` cron route, which nulls the same columns in the DB. The read-time check makes correctness independent of whether/how often that cron actually runs — no `vercel.json` cron schedule is checked into this repo, so its cadence lives outside this codebase.

---

## Database Changes
No new tables. Uses:
- `wishlists` (visibility, `prices_visible`; no `status`/`share_token` columns)
- `occasions` (`status`, `archived_at`, now included in the RPC's occasion object)
- `wishlist_items`, `wishlist_invites`, `users`
- `gifvtme_get_shared_wishlist()` — migration 006, extended by migration 013 to add the `access` field and occasion status

Intent flag fields on `wishlist_items` (migration 006, **not** 003):
```sql
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_at TIMESTAMPTZ;
```

---

## API Endpoints
No dedicated API for the page itself — server-rendered. Reminder opt-in is two POST routes (not the originally-proposed single PATCH), matching Functional Requirement 6:

### `POST /api/wishlists/[id]/invites/[inviteId]/opt-in`
For an existing invitee. **Auth:** required. **Response:** `{ ok: true, reminders_scheduled: boolean }`.

### `POST /api/wishlists/[id]/reminders/opt-in`
For any authenticated viewer of a `public` wishlist without an existing invite — creates one. **Auth:** required. **Response:** `{ ok: true, reminders_scheduled: boolean }`.

Neither endpoint supports opting back out (`{ opted_in: false }`) — opt-in is one-directional as shipped.

---

## Permissions and Authorization
Access control is enforced inside the SECURITY DEFINER `gifvtme_get_shared_wishlist()` RPC, not by raw table RLS on read:
- Invalid/expired token, or an id that matches nothing → `access: 'not_found'`.
- A real wishlist that the viewer isn't allowed to see (private; or friends_family/private visited by `id` without a valid invite token) → `access: 'restricted'`.
- `public` wishlist, or any wishlist viewed by its owner → `access: 'ok'`.

No user auth required for viewing — Supabase anonymous key used for unauthenticated reads.

---

## Validation
No form submission on this page — it's primarily a read-only view. Reminder opt-in is a single button with no form fields.

---

## Error Handling

| Scenario | Page shown |
|---|---|
| Token/id not found | `app/w/[id]/not-found.tsx`: "This wishlist link isn't valid or has expired." |
| Wishlist is private/restricted | "This wishlist is private." |
| Wishlist occasion archived | "This occasion has passed." with a link to `/shop` |
| Data fetch error (RPC error) | "Something went wrong loading this wishlist. Please try refreshing." |

---

## Loading and Empty States
Since this is server-rendered, there's no client loading state for the initial page (`app/w/[id]/loading.tsx` provides a skeleton for the streaming/suspense boundary). For the reminder opt-in button: shows a brief spinner while the request fires.

**Empty wishlist:** "[Receiver] hasn't added any wishes yet." (or "Add items to your wishlist" for the owner).
**All claimed:** banner + items still shown.
**Filtered to "Available" with none available:** "All items have been claimed! 🎉"
**Filtered to "Claimed" with none claimed:** "Nothing's been claimed yet — be the first!"

---

## Edge Cases

1. **Occasion date has passed but occasion not yet auto-archived.** Countdown shows "Passed" (muted chip) — not a negative number, not "Today!". The occasion functions normally (items still purchasable); the "occasion has passed" full-page notice only appears once `occasions.status = 'archived'`.

2. **Wishlist has items from both `external` and `catalog` origins.** The shared view renders both identically — origin is only relevant in the item detail view where the CTA differs.

3. **A catalog product was archived/deleted in Sanity after being added to the wishlist.** The `wishlist_items` row still exists. `lib/wishlist/shared.ts` batch-checks all `catalog_product_id` values against Sanity (`CART_PRICES_QUERY`) on each load; a missing or non-`active` product renders as a muted "No longer available" card with no buy action.

4. **Page is viewed by the wishlist owner themselves.** `viewer_is_owner` (owner id matches the authenticated viewer) shows a "You're viewing your wishlist as others see it" banner with a link back to managing it, and grants `access: 'ok'` regardless of visibility.

5. **Intent flag expired.** `intent_flagged_at` older than 24h is nulled at read time in `lib/wishlist/shared.ts`, independent of the `/api/reminders` cron's own cleanup.

6. **Prices visible is false, but a catalog item's price changes (flash sale starts).** Non-issue — `price` is never sent to the client at all when `prices_visible=false`, regardless of what the current Sanity price is.

7. **The share link is indexed by Google** (public wishlist). Intentional — drives organic acquisition. `generateMetadata` in `app/w/[id]/page.tsx` sets `<title>[Name]'s Wishlist for [Occasion]</title>` and a matching description for public wishlists; non-public wishlists get `robots: { index: false, follow: false }`.

---

## Analytics / Events
- `shared_wishlist.viewed` — `{ item_count, available_count, claimed_count, is_occasion, days_remaining }`
- `shared_wishlist.filter_changed` — `{ filter }`
- `shared_wishlist.cta_clicked` — `{ cta: 'create_wishlist' | 'powered_by' }`
- `reminder_optin.accepted` — fired on successful reminder opt-in (naming differs from the original `shared_wishlist.reminder_opt_in` proposal)
- Item click-through analytics live on the item-detail giver page, not this one.

---

## Testing Requirements

### Integration tests
- Public wishlist is accessible without auth (anon Supabase key).
- Friends_family wishlist with valid token: accessible.
- Friends_family wishlist with wrong token: returns the private/not-found page.
- Private wishlist token: returns the private page.
- Claimed item: correctly shows "Claimed" badge.
- Prices hidden: no price data anywhere in the rendered payload.

### Manual QA
- Share a public wishlist, open in incognito — verify full view with correct prices/items.
- Mark an item as purchased in another tab, refresh the shared wishlist — verify it shows "Claimed."
- Set `prices_visible=false`, refresh shared wishlist — verify no prices visible (check page source, not just the rendered UI).
- View a wishlist with all items claimed — verify the celebratory banner and that items still render.
- Click "Remind me" — verify opt-in toggled (check DB).
- Archive a catalog product in Sanity that's on a shared wishlist — verify it renders "No longer available".
- Archive an occasion (or wait for the 7-day auto-archive) — verify the shared link shows the "occasion has passed" notice.

---

## Acceptance Criteria
- [x] Any valid public link renders the wishlist fully server-side within 2 seconds.
- [x] Friends_family links only work with a valid invite token.
- [x] Private wishlists show a "this is private" page for non-owners, distinguishable from a not-found link.
- [x] Item status accurately reflects real-time purchased state.
- [x] Prices are fully absent from the payload when `prices_visible=false`.
- [x] Reminder opt-in is shown per Functional Requirement 6 (invitees, plus any authenticated viewer of a public wishlist).
- [x] Intent flags older than 24 hours are not shown.

---

## Future Improvements
- Real-time updates when an item is claimed while the giver is viewing the page (Supabase realtime subscription).
- Giver "heart" reaction on items (signal interest without committing).
- Crowdfunding meter on items flagged for group gifting (v2).
- OG image generation for social sharing previews.
