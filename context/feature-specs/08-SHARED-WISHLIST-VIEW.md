# Feature: Shared Wishlist View (Giver Landing Page)

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
1. Route: `/w/[id]` — `id` resolves as either a `wishlist_invites.token` (friends_family) or `wishlists.share_token` (public). See `01-WISHLIST-SHARING.md` for resolution logic.
2. If the wishlist is `private` or the token is invalid: show a "This wishlist is private" page (not a 404 — differentiate "doesn't exist" from "exists but restricted").
3. If the wishlist is archived (occasion is archived): show a "This occasion has passed" page.
4. Item availability is read from the `wishlist_items_with_status` view (considers both `purchases` table for external flow and `orders` table for catalog flow).
5. If `prices_visible=false` on the wishlist: price fields are completely hidden, not replaced with "hidden" text.
6. Reminder opt-in: shown only for invitees (has a `wishlist_invites` row) on occasion wishlists (has an `occasion_date`). Toggles `wishlist_invites.reminder_opted_in`. Not shown for public-link viewers with no invite row.
7. Server-rendered for performance and SEO — the page is a Next.js server component. Item status is fetched fresh on each load (no stale claimed states).
8. An intent-flag (soft "someone's planning to buy this") is displayed on item cards where `intent_flagged_at` is within the last 24 hours.

---

## Non-Functional Requirements
- Page must be fully rendered (not a loading shell) within 2 seconds for a fresh load. Server render ensures the content is immediately visible without client-side JS execution.
- The page must work with JavaScript disabled (basic read-only view — only interactive features like reminder opt-in require JS).

---

## UI Requirements

### Page structure

**Header:**
- Receiver's avatar (circular, 64px) + name (h1)
- Occasion type icon + occasion name (if occasion wishlist)
- Countdown chip: "In 14 days" (green if >7 days, amber if ≤7, red if ≤3, "Today!" if same day, "Passed" if past with no replacement copy)
- Subtle: "Shared by [receiver_name] · [item_count] wishes"

**Reminder opt-in banner** (shown once, dismissible, only for invitees):
- "Get a reminder before [receiver_name]'s [occasion]?"
- "Remind me" button → toggles `reminder_opted_in = true`, replaces with "✓ You'll be reminded"

**Filter pills:**
- "All" | "Available" | "Claimed"
- Active filter has brand background

**Item grid:**
- Mobile: 2-column grid
- Desktop: 3–4 column grid
- Each card:
  - Product image (full width of card, 3:4 aspect ratio, object-cover)
  - Item title (2 lines max, ellipsis)
  - Price (if `prices_visible=true` and price exists) — formatted via `formatPrice()`
  - Status badge: "Available" (default, brand-light bg) or "Claimed" (muted, with gift wrap icon)
  - Intent flag indicator (subtle): "Someone's planning to buy this" — shown as a small amber chip under the status badge, only when `intent_flagged_at` is within 24 hours
  - Clicking the card navigates to `/w/[id]/item/[itemId]`

**Footer:**
- "Powered by Gifvtme · gifvtme.com" — subtle brand watermark for public wishlists (drives acquisition)
- For logged-in users viewing someone else's wishlist: "Create your own wishlist" CTA

**Empty state (no items):**
- "[Receiver name] hasn't added any wishes yet."
- If they're the owner viewing their own occasion (edge case — they shouldn't reach this via `/w/`, but defensive): "Add items to your wishlist"

**All-claimed state:**
- "🎁 Everything on this list has been gifted!" banner, full width
- Remaining item grid still shows (all with claimed badges) — don't hide them

---

## Backend Logic

### Page data fetching (server component)
```typescript
// app/w/[id]/page.tsx

// 1. Resolve the token
const invite = await supabase.from('wishlist_invites').select('*, wishlists(*)').eq('token', id).single()
let wishlist, isInviteViewer = false

if (invite) {
  wishlist = invite.wishlists
  isInviteViewer = true
} else {
  // Try as a public share_token
  wishlist = await supabase.from('wishlists').select('*').eq('share_token', id).eq('visibility', 'public').single()
}

if (!wishlist) notFound() // 404

if (wishlist.status === 'archived') return <ArchivedPage />
if (wishlist.visibility === 'private') return <PrivatePage />

// 2. Fetch items with status
const items = await supabase.from('wishlist_items_with_status')
  .select('*')
  .eq('wishlist_id', wishlist.id)
  .order('sort_order', { ascending: true })

// 3. Fetch occasion details (if occasion wishlist)
let occasion = null
if (wishlist.occasion_id) {
  occasion = await supabase.from('occasions').select('*').eq('id', wishlist.occasion_id).single()
}

// 4. Fetch receiver profile
const receiver = await supabase.from('users').select('full_name, avatar_url').eq('id', wishlist.user_id).single()

// 5. Check current viewer's opt-in status (if they're an invitee and logged in)
// passed down to the ReminderOptIn client component
```

### Intent flag expiry (passive, on page load)
Item cards should not show intent flags where `intent_flagged_at < NOW() - INTERVAL '24 hours'`. This check is done in the query — filter on the client side or add to the view definition.

---

## Database Changes
No new tables. Uses:
- `wishlists` + `share_token` (added in `01-WISHLIST-SHARING.md`)
- `wishlist_items_with_status` view (migration 002)
- `occasions`, `users`, `wishlist_invites`

Intent flag fields on `wishlist_items` (migration 003):
```sql
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_at TIMESTAMPTZ;
```

---

## API Endpoints
No dedicated API — this is a server-rendered page. The reminder opt-in toggle is a client-side action:

### `PATCH /api/invites/[inviteId]/reminder-opt-in`
Toggle reminder opt-in for an invite.
**Auth:** required.
**Body:** `{ opted_in: boolean }`
**Response:** `{ updated: true }`.

---

## Permissions and Authorization
Access control enforced by the token resolution logic (not just RLS):
- Invalid/expired token → 404.
- `private` wishlist with no valid token → "Private" page.
- `friends_family` wishlist → only invitees via token.
- `public` wishlist → anyone.

No user auth required for viewing — Supabase anonymous key used for unauthenticated reads.

---

## Validation
No form submission on this page — it's primarily a read-only view. Reminder opt-in is a single button with no form fields.

---

## Error Handling

| Scenario | Page shown |
|---|---|
| Token not found | Custom 404: "This wishlist link isn't valid or has expired." |
| Wishlist is `private` | "This wishlist is private." |
| Wishlist occasion archived | "This occasion has passed." with link to explore the gift museum |
| Data fetch error | "Something went wrong loading this wishlist. Please try refreshing." |

---

## Loading and Empty States
Since this is server-rendered, there's no client loading state for the initial page. For the reminder opt-in button: shows a brief spinner while the PATCH fires.

**Empty wishlist:** "[Receiver] hasn't added any wishes yet."
**All claimed:** Celebratory banner, items still shown.
**Filtered to "Available" with none available:** "All items have been claimed! 🎉"
**Filtered to "Claimed" with none claimed:** "Nothing's been claimed yet — be the first!"

---

## Edge Cases

1. **Occasion date has passed but occasion not yet auto-archived.** Show the countdown as "Passed" — don't show a negative number or pretend the event is still upcoming. The occasion functions normally (items still purchasable).

2. **Wishlist has items from both `external` and `catalog` origins.** The shared view renders both identically — origin is only relevant in the item detail view where the CTA differs.

3. **A catalog product was archived in Sanity after being added to the wishlist.** The `wishlist_items` row still exists. On the shared view, the item card should show "No longer available" (as a muted overlay or badge) instead of a regular card. Check Sanity `_id` availability at page load: batch fetch all `catalog_product_id` values and filter out archived ones.

4. **Page is viewed by the wishlist owner themselves.** They see their own wishlist from the giver's perspective (useful for previewing before sharing). A subtle "This is your wishlist — you're viewing it as others see it" banner can improve clarity.

5. **Intent flag expired.** `intent_flagged_at` is set but older than 24 hours — the "Someone's planning to buy this" chip must not show. Filter this server-side in the query.

6. **Prices visible is false, but a catalog item's price changes (flash sale starts).** Since prices are hidden, this is a non-issue for the viewer. The price-visibility setting takes precedence over all pricing logic.

7. **The share link is indexed by Google** (public wishlist). This is intentional and a feature — it drives organic acquisition. The page should have appropriate meta tags: `<title>[Name]'s Wishlist for [Occasion]</title>` and `<meta name="description" content="Help [Name] celebrate their [occasion] — view their wishlist on Gifvtme.">`.

---

## Analytics / Events
- `shared_wishlist.viewed` (visibility: public | friends_family, is_owner: bool, has_occasion: bool)
- `shared_wishlist.reminder_opt_in` (opted_in: bool)
- `shared_wishlist.item_clicked` (origin: external | catalog)
- `shared_wishlist.filter_changed` (filter: all | available | claimed)
- `shared_wishlist.cta_clicked` (cta: 'create_wishlist' | 'powered_by')

---

## Testing Requirements

### Integration tests
- Public wishlist is accessible without auth (anon Supabase key).
- Friends_family wishlist with valid token: accessible.
- Friends_family wishlist with wrong token: returns private/not-found page.
- Private wishlist token: returns private page.
- Claimed item: correctly shows "Claimed" badge (tests the `wishlist_items_with_status` view).
- Prices hidden: no price data in rendered HTML.

### Manual QA
- Share a public wishlist, open in incognito — verify full view with correct prices/items.
- Mark an item as purchased in another tab, refresh the shared wishlist — verify it shows "Claimed."
- Set `prices_visible=false`, refresh shared wishlist — verify no prices visible.
- View a wishlist with all items claimed — verify celebratory state.
- Click "Remind me" — verify opt-in toggled (check DB).

---

## Acceptance Criteria
- [ ] Any valid public link renders the wishlist fully server-side within 2 seconds.
- [ ] Friends_family links only work with a valid invite token.
- [ ] Private wishlists show a "this is private" page for non-owners.
- [ ] Item status accurately reflects real-time purchased state from the `wishlist_items_with_status` view.
- [ ] Prices are fully hidden when `prices_visible=false`.
- [ ] Reminder opt-in is only shown to users with a `wishlist_invites` row for an occasion wishlist.
- [ ] Intent flags older than 24 hours are not shown.

---

## Future Improvements
- Real-time updates when an item is claimed while the giver is viewing the page (Supabase realtime subscription).
- Giver "heart" reaction on items (signal interest without committing).
- Crowdfunding meter on items flagged for group gifting (v2).
- OG image generation for social sharing previews.
