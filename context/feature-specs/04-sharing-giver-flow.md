# Feature Spec: Sharing & Giver Flow

**Project:** Gifvtme
**Module:** 03 — Sharing & Giving
**Priority:** Core
**Depends on:** Auth flow, Evergreen wishlist, and Occasion wishlist features complete. Supabase migrations 001, 002, 003 running.
**Agent instruction:** Implement both UI and backend logic together. Apply the responsive rules from `RESPONSIVE_DESIGN_DIRECTIVE.md` for desktop adaptation. Make reasonable decisions where unspecified and note them in comments. Do not ask for clarification.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Icons:** lucide-react
- **Forms:** react-hook-form + Zod
- **Animation:** GSAP + @gsap/react
- **Database:** Supabase (PostgreSQL with RLS)
- **Email:** Resend
- **Path alias:** `@/` maps to `src/`

---

## Overview

This feature completes the core gifting loop. It covers two sides of the same experience: the **receiver** controlling who can see their wishlist and sharing it, and the **giver** landing on a shared link, browsing available gifts, and completing a purchase.

There are two transaction paths depending on the item's origin:
- **External items** (`origin='external'`): giver is redirected to the original store via an affiliate link. After purchasing, they return and confirm. The item is marked claimed.
- **Catalog items** (`origin='catalog'`): giver goes through Gifvtme's own checkout (this connects to the checkout feature — for now, the "Buy this gift" button for catalog items can link to a stub checkout page).

This feature spec covers:
1. Wishlist visibility settings (private / friends & family / public)
2. Price visibility toggle
3. Inviting people by email or phone
4. The shareable link (token-based for friends & family, direct ID for public)
5. The shared wishlist view — what givers see
6. Item detail view (giver perspective)
7. Affiliate redirect and purchase confirmation flow
8. Claimed success screen with reminder opt-in
9. The "someone else is buying this" intent flag

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Wishlist share settings | Sheet on `/dashboard/wishlists/[id]` | Visibility, price toggle, invite management |
| Shared wishlist view | `/w/[id]` | What givers see when they open the link |
| Item detail (giver) | `/w/[id]/item/[itemId]` | Full item detail with buy CTA |
| Purchase confirmation | `/w/[id]/confirm/[itemId]` | "Did you buy this?" for external items |
| Claimed success | `/w/[id]/success/[itemId]` | Success screen + reminder opt-in |

---

## User Flows

### Receiver shares their wishlist
```
Wishlist detail → "Share" button
→ Share settings sheet opens
→ Set visibility: Private / Friends & Family / Public
→ Toggle price visibility on/off
→ If Friends & Family: enter email or phone → "Send invite"
→ Copy shareable link
→ Send link to people
```

### Giver opens a shared link (external item)
```
Opens /w/[token or id]
→ Sees receiver's wishlist (name, occasion, countdown, items)
→ Taps "Buy this gift" on an available item
→ If not logged in: prompted to log in / sign up first
→ Navigates to /w/[id]/item/[itemId]
→ Sees item detail with "Buy this gift" CTA
→ Taps "Buy this gift" → opens the external store in a new tab (affiliate URL)
→ Completes purchase on the external store
→ Returns to Gifvtme tab (or navigates to /w/[id]/confirm/[itemId])
→ Confirms "Yes, I bought it"
→ Item marked as purchased
→ Navigates to /w/[id]/success/[itemId]
→ Sees success screen + reminder opt-in
```

### Giver flags intent
```
Item detail → taps "Someone else is buying this"
→ Item shows amber warning badge to all givers
→ Flag auto-expires after 24 hours
```

---

## Detailed Screen Requirements

### Screen 1 — Share Settings Sheet

**Triggered by:** "Share" button on the wishlist detail page (`/dashboard/wishlists/[id]`)

**Opens as:** shadcn/ui `Sheet` sliding up from the bottom on mobile, `Dialog` on desktop

**Sheet title:** "Share your wishlist"

---

**Section: Who can see this?**

Three large radio-style option cards (full width, stacked):

**Private card:**
- Icon: `Lock` (lucide-react, 20px)
- Label: "Private"
- Subtext: "Only you"
- Selected state: brand-red border + `#FEF2F2` background

**Friends & Family card:**
- Icon: `Users` (lucide-react, 20px)
- Label: "Friends & Family"
- Subtext: "Only people you invite"
- Selected state: same as above

**Public card:**
- Icon: `Globe` (lucide-react, 20px)
- Label: "Public"
- Subtext: "Anyone with the link"
- Selected state: same as above

Changing the selection immediately updates `wishlists.visibility` via API (no save button needed for this field — auto-save on selection).

---

**Section: Show prices?** (visible regardless of visibility setting)

Toggle row:
- Label: "Show prices to viewers"
- shadcn/ui `Switch` component (right-aligned)
- Default: on
- Toggling immediately updates `wishlists.prices_visible` via API (auto-save)

---

**Section: Invite people** (shown only when Friends & Family is selected)

- Input field: placeholder "Email address or phone number"
- "Send invite" button (brand red, pill, right of input)
- On submit: creates a `wishlist_invites` row and sends an invitation email via Resend
- List of current invites below:
  - Each row: avatar/initials circle + email or phone + "Remove" button (ghost, small)
  - Status: "Accepted" (green dot) or "Pending" (grey dot)
- Empty invite list: "No one invited yet"

---

**Section: Share link**

- Display the shareable URL (truncated with ellipsis in the middle)
- For Friends & Family: the URL uses the invite token (`/w/[token]`)
- For Public: the URL uses the wishlist ID directly (`/w/[wishlistId]`)
- "Copy link" button — copies to clipboard, shows "Copied! ✓" for 2 seconds (GSAP fade-in/out)
- Below the copy button: WhatsApp share button (opens `https://wa.me/?text=[encoded-message]`) — pre-composed message: "Hey! I've created a wishlist for my [occasion] — here's the link: [url]"

---

### Screen 2 — Shared Wishlist View (`/w/[id]`)

This is a public-facing page. No dashboard layout. No navbar. Custom minimal header.

**URL resolution:**
- Try resolving `[id]` as a `wishlist_invites.token` first
- If found: use the linked `wishlist_id`
- If not found: treat `[id]` as a `wishlists.id` directly (for public wishlists)
- If still not found or wishlist is `private`: `notFound()` → 404

**Page layout (mobile):**

**Header section (brand red background):**
- Receiver avatar (48px circle, initials fallback with a consistent color derived from user ID)
- "Wishlist by" label (small, white/70% opacity)
- Receiver full name (white, bold)
- Occasion title + emoji (if linked to an occasion)
- Days countdown: "14 days to go" — white text. Hidden if no occasion or occasion date passed.

**Filter pills (white background, below header):**
- "All items ([total])", "Available ([count])", "Claimed ([count])"
- Horizontally scrollable on mobile
- Active pill: brand-red background, white text
- Inactive pill: `#F7F7F7` background, muted text
- Filtering is client-side — no re-fetch

**Item list:**

Each **available item card:**
- Product image (64px × 64px square, `rounded-xl`, grey placeholder if no image)
- Title (font-medium, truncated 2 lines)
- Price (formatted ₦X,XXX) — shown only if `wishlists.prices_visible=true`
- Source badge: "From [domain]" for external items, "Gifvtme store" badge for catalog items
- "Available" status badge (green pill) — subtle
- "Buy this gift" button (brand red, pill, small) — right side
- Intent flag warning (if `intent_flagged_by` is not null): amber pill "⚠️ Someone is getting this" shown below the title

Each **claimed item card:**
- Same layout but 50% opacity
- Title with strikethrough
- "Claimed ✓" badge (muted green) replacing the buy button
- No buy CTA

**Sticky bottom (mobile only):**
- Reminder opt-in button: bell icon + "Remind me before [Name]'s [occasion]"
- Ghost/outline style, full width
- Only shown for occasions with a future date
- Tapping opens the reminder opt-in flow (see below)

**Empty states:**
- All items claimed: "Everything on this list has been gifted! 🎉" — celebratory
- No items on list: "This wishlist is empty — check back soon."

**Desktop adaptation:**
- Two-column item grid (2 cards per row) centered at max-width 680px
- Receiver info in a sticky left sidebar (desktop only): avatar, name, occasion, countdown, reminder button
- Item list takes the right/center area

---

### Screen 3 — Item Detail, Giver View (`/w/[id]/item/[itemId]`)

**Header:**
- Back arrow → `/w/[id]`
- "Wishlist" label (center)
- Cart icon (top right — for catalog items only, links to cart)

**Product image:**
- Large image area (full width on mobile, 16:9 or square aspect ratio)
- If no image: large grey placeholder with `Gift` icon
- Store badge overlay: "From [domain]" for external, "Gifvtme store" for catalog

**Product info:**
- Price (large, bold, brand red) — only if `prices_visible=true`
- Title
- Star rating (if catalog item with reviews — show "4.5 ★ (52 reviews)")
- Stock status: "2 in stock" (green) / "Limited" (amber) — for catalog items only

**Wishlist context line:**
- Receiver avatar (small, 24px) + "On [Receiver Name]'s [Occasion] wishlist"

**Info box (for external items):**
- Light grey background, `rounded-xl`
- `Info` icon (lucide-react)
- "You'll be redirected to [domain] to complete your purchase. The item will be marked as claimed so no one buys it twice."

**Intent flag warning (if flagged):**
- Amber/yellow box: "⚠️ Someone has indicated they're buying this. You can still buy it."

**Primary CTA — External item:**
- "Buy this gift" button (brand red, pill, full width, large)
- Below: "Opens [domain] in a new tab"

**Primary CTA — Catalog item:**
- "Buy this gift" button (brand red, pill, full width, large)
- Links to `/checkout?item=[itemId]` (stub for now if checkout not yet built)

**Secondary CTA (both item types):**
- "Someone else is buying this" button (ghost/outline, full width)
- Sets the intent flag on the item

**"Ask a Question" and "Delivery Return" info links** (catalog items only — matching the Figma design):
- Small icon + text links in a row below the CTAs

**Auth gate:**
- If the user taps either CTA and is not logged in:
  - Show a bottom sheet: "You need an account"
  - Body: "Sign in to buy gifts and let [Receiver] know it's coming."
  - "Log in" button (brand red, full width)
  - "Create account" button (ghost, full width)
  - Both preserve the `redirect` URL param back to this page

---

### Screen 4 — Purchase Confirmation (`/w/[id]/confirm/[itemId]`)

**When shown:** After a giver clicks "Buy this gift" on an external item and returns from the external store.

**How they get here:**
- After clicking "Buy this gift", the external store opens in a new tab
- The current tab shows the item detail page with a prompt: "Once you've bought it on [domain], come back and confirm below"
- A "I bought it" button on the item detail page navigates to this confirm page
- Alternatively, the confirm URL can be opened directly from the external store's tab

**Layout:**

**Item summary card:**
- Product thumbnail (56px × 56px), title, source domain, price
- "From [Receiver]'s wishlist" tag in brand-light background

**Question:**
- Headline: "Did you complete your purchase on [domain]?"
- Subtext: "Confirming lets [Receiver Name] know their gift is on the way, and stops others from buying the same thing."

**Privacy note:**
- Grey info box: "Your payment details stay on [domain] — Gifvtme only records that this item has been claimed."

**CTAs:**
- "Yes, I bought it" — brand red, pill, full width (primary)
- "No, I changed my mind" — ghost, pill, full width (secondary) → navigates back to `/w/[id]`

**On "Yes, I bought it":**
1. Call `POST /api/purchases` with `{ wishlist_item_id: itemId }`
2. Button shows "Confirming…" + spinner, disabled
3. On success: navigate to `/w/[id]/success/[itemId]`
4. On 409 (race condition — already purchased): show "Someone just claimed this — they got there first!" → navigate back to `/w/[id]`
5. On error: toast "Couldn't confirm. Try again." button re-enabled

---

### Screen 5 — Claimed Success (`/w/[id]/success/[itemId]`)

**Layout:** Full screen, centered vertically

**Success icon:**
- Large circle (80px) with brand-light background (`#FEF2F2`)
- `CheckCircle` icon (lucide-react, 40px, brand red) inside
- GSAP entrance: scale from 0 → 1 with `back.out(2)` easing

**Content:**
- Headline: "Gift claimed! 🎉"
- Body: "You've claimed [item title] for [Receiver Name]'s [Occasion]. [Receiver Name] will be notified and will send you a thank you."

**Reminder opt-in card** (shown only for occasions with a future date):
- Card with subtle border: `rounded-2xl`, `border border-stone-100`
- Bell icon + "Get a reminder before [Receiver]'s [Occasion]"
- Subtext: "We'll remind you 2 weeks and 3 days before [Occasion] on [Date]."
- "Yes, remind me" button (brand red, pill, full width)
- "No thanks" text button below (muted, no border)

**On "Yes, remind me":**
- If the giver arrived via an invite token: update `wishlist_invites.reminder_opted_in=true` for their invite row and create `reminders` rows
- If the giver is on a public wishlist (no invite token): create a `wishlist_invites` row for them first with `reminder_opted_in=true`, then create reminders

**Footer CTA:**
- "View [Receiver]'s full wishlist" ghost button → navigates back to `/w/[id]`

---

## Backend Requirements

### Visibility and price toggle

**`PATCH /api/wishlists/[id]`** (already exists — extend it)

Add `visibility` and `prices_visible` to the accepted body fields. Auto-save on change — no separate "Save" button.

```typescript
const WishlistUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  visibility: z.enum(['private', 'friends_family', 'public']).optional(),
  prices_visible: z.boolean().optional()
})
```

### Create invite

**`POST /api/wishlists/[id]/invites`**

```typescript
const InviteSchema = z.object({
  invitee_email: z.string().email().optional(),
  invitee_phone: z.string().regex(/^(\+234|0)[789][01]\d{8}$/).optional()
}).refine(
  data => data.invitee_email || data.invitee_phone,
  { message: 'Provide either an email or a phone number' }
)
```

Implementation:
1. Check for duplicate invite (same email/phone already invited to this wishlist) — return 409 if duplicate
2. Insert `wishlist_invites` row (token is auto-generated by DB default)
3. If `invitee_email` provided: send Resend invitation email
4. Return the created invite row with its token

**Invitation email (Resend):**
- From: `Gifvtme <noreply@gifvtme.co>`
- Subject: "[Receiver Name] shared their wishlist with you 🎁"
- Body: "[Receiver Name] has invited you to see their wishlist. Click below to view it." + "View wishlist" button linking to `/w/[token]`

### Delete invite

**`DELETE /api/wishlists/[id]/invites/[inviteId]`**

Deletes the `wishlist_invites` row. DB cascade removes associated `reminders` rows.

### Resolve shared wishlist (`/w/[id]` page)

Server component logic:

```typescript
// 1. Try resolving as an invite token
const { data: invite } = await supabase
  .from('wishlist_invites')
  .select('wishlist_id, invitee_user_id')
  .eq('token', id)
  .maybeSingle()

const wishlistId = invite?.wishlist_id ?? id

// 2. Fetch wishlist with RLS (handles public/friends_family/private access)
const { data: wishlist } = await supabase
  .from('wishlists')
  .select(`
    id, title, visibility, prices_visible,
    users!inner(id, full_name, avatar_url),
    occasions(id, title, occasion_type, occasion_date),
    wishlist_items_with_status(
      id, title, image_url, product_url, affiliate_url,
      price, origin, catalog_product_id, status,
      is_exclusive, sort_order,
      intent_flagged_by, intent_flagged_at,
      affiliate_buyer_id, purchase_id,
      order_buyer_id, order_id, order_status
    )
  `)
  .eq('id', wishlistId)
  .single()

if (!wishlist) notFound()
if (wishlist.visibility === 'private') notFound()

// 3. If authenticated, auto-accept the invite
if (invite && currentUser && !invite.invitee_user_id) {
  await supabase
    .from('wishlist_invites')
    .update({ invitee_user_id: currentUser.id })
    .eq('token', id)
    .is('invitee_user_id', null)
}
```

### Mark purchase (external items)

**`POST /api/purchases`**

```typescript
const PurchaseSchema = z.object({
  wishlist_item_id: z.string().uuid()
})

// 1. Auth check — must be logged in
// 2. Verify item exists, status='available', origin='external'
// 3. Insert purchases row
// 4. on_purchase_created trigger handles: marking item purchased, marking master_item purchased, creating thank_you_messages row
// 5. Return 201 on success, 409 on duplicate (race condition)
```

Catch the unique constraint violation (`error.code === '23505'`) and return a clean 409 with a user-friendly message.

### Intent flag

**`POST /api/wishlists/items/[itemId]/flag-intent`**

Sets `intent_flagged_by` and `intent_flagged_at` on the `wishlist_items` row.
Only sets if `status='available'` and `intent_flagged_by IS NULL`.
Returns 200 on success, 409 if already flagged.

**`DELETE /api/wishlists/items/[itemId]/flag-intent`**

Clears the flag — only if `intent_flagged_by = auth.uid()` (user can only clear their own flag).

**Intent expiry:** Add to the `/api/reminders` cron job:
```sql
UPDATE public.wishlist_items
SET intent_flagged_by = NULL, intent_flagged_at = NULL
WHERE intent_flagged_at < NOW() - INTERVAL '24 hours'
  AND status = 'available';
```

### Reminder opt-in (from success screen)

**`POST /api/wishlists/[id]/invites/[inviteId]/opt-in`** (for invite-based access)
OR
**`POST /api/wishlists/[id]/reminders/opt-in`** (for public wishlist access — creates invite first)

```typescript
// For invite-based:
await supabase
  .from('wishlist_invites')
  .update({ reminder_opted_in: true })
  .eq('id', inviteId)
  .eq('invitee_user_id', userId)

// Then schedule reminders
const occasion = wishlist.occasions
if (occasion?.occasion_date && new Date(occasion.occasion_date) > new Date()) {
  await scheduleInviteeReminders(supabase, userId, inviteId, occasion.occasion_date)
}
```

---

## Database Changes

### New column on `wishlist_items` (add to migration 003 or a new migration 004)

```sql
ALTER TABLE public.wishlist_items
  ADD COLUMN intent_flagged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN intent_flagged_at timestamptz;

CREATE INDEX ON public.wishlist_items (intent_flagged_at)
  WHERE intent_flagged_at IS NOT NULL;
```

### Resend configuration

The agent must note in a comment that sending invitation emails via Resend requires:
- `RESEND_API_KEY` in `.env.local`
- `RESEND_FROM_EMAIL` in `.env.local`
- A verified sender domain in the Resend dashboard

If `RESEND_API_KEY` is not set, the invite creation should still succeed (the `wishlist_invites` row is created) but log a warning that the email was not sent.

---

## API Endpoints Summary

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `PATCH` | `/api/wishlists/[id]` | Update visibility, price toggle, title | Required, must own |
| `GET` | `/api/wishlists/[id]/invites` | List invites | Required, must own |
| `POST` | `/api/wishlists/[id]/invites` | Create invite + send email | Required, must own |
| `DELETE` | `/api/wishlists/[id]/invites/[inviteId]` | Revoke invite | Required, must own |
| `POST` | `/api/purchases` | Mark external item as purchased | Required |
| `POST` | `/api/wishlists/items/[itemId]/flag-intent` | Set intent flag | Required |
| `DELETE` | `/api/wishlists/items/[itemId]/flag-intent` | Clear intent flag | Required, must be flagger |
| `POST` | `/api/wishlists/[id]/invites/[inviteId]/opt-in` | Opt into reminder | Required |

---

## File Structure

```
src/
  app/
    w/
      [id]/
        page.tsx                    ← Shared wishlist view (server component)
        item/
          [itemId]/
            page.tsx                ← Item detail, giver view (server component)
        confirm/
          [itemId]/
            page.tsx                ← Purchase confirmation (client component)
        success/
          [itemId]/
            page.tsx                ← Claimed success + reminder opt-in
    api/
      wishlists/
        [id]/
          route.ts                  ← Extend with visibility/prices_visible PATCH
          invites/
            route.ts                ← GET, POST
            [inviteId]/
              route.ts              ← DELETE
              opt-in/
                route.ts            ← POST
        items/
          [itemId]/
            flag-intent/
              route.ts              ← POST, DELETE
      purchases/
        route.ts                    ← POST (mark external purchase)
  components/
    wishlist/
      ShareSettingsSheet.tsx        ← Visibility/invite management sheet
      SharedWishlistHeader.tsx      ← Red header with receiver info + countdown
      SharedWishlistItem.tsx        ← Item card for the giver view
      ClaimedBadge.tsx              ← "Claimed ✓" badge component
      IntentFlagBadge.tsx           ← "⚠️ Someone is getting this" badge
      ReminderOptIn.tsx             ← Opt-in card on success screen
      AuthGateSheet.tsx             ← "You need an account" bottom sheet
    shared/
      CopyLinkButton.tsx            ← Copy to clipboard with "Copied!" feedback
```

---

## Design System Reference

| Token | Value |
|---|---|
| Primary color | `#C50404` |
| Brand light | `#FEF2F2` |
| Secondary text | `#4A4A4A` |
| Surface | `#F7F7F7` |
| Intent flag color | `#F59E0B` (amber) |
| Font | Inter |
| Button shape | `rounded-full` |
| Card shape | `rounded-2xl` |

**Status colors:**
- Available: no badge needed (default)
- Claimed: `bg-stone-100 text-stone-500` with strikethrough title
- Intent flagged: `bg-amber-50 text-amber-700 border border-amber-200`

---

## GSAP Animations

| Element | Animation |
|---|---|
| Shared wishlist header entrance | `gsap.from(header, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.out' })` |
| Item cards stagger entrance | `gsap.from(cards, { opacity: 0, y: 20, stagger: 0.06, duration: 0.3 })` |
| Filter pill change | `gsap.to(activeIndicator, { x: newPosition, duration: 0.2, ease: 'power2.inOut' })` |
| "Copied!" feedback | `gsap.from(copiedLabel, { opacity: 0, scale: 0.8, duration: 0.2 })` then fade out after 2s |
| Success checkmark | `gsap.from(checkIcon, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)' })` |
| Intent flag badge appearance | `gsap.from(badge, { opacity: 0, x: -10, duration: 0.2 })` |
| Claimed item transition (on purchase) | `gsap.to(itemCard, { opacity: 0.5, duration: 0.3 })` + strikethrough animation |
| Confirmation "Yes" button | `gsap.to(btn, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 })` on tap |

---

## Validation Rules

### Invite
```typescript
const InviteSchema = z.object({
  invitee_email: z.string().email('Enter a valid email').optional(),
  invitee_phone: z.string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number')
    .optional()
}).refine(
  d => d.invitee_email || d.invitee_phone,
  { message: 'Enter an email or phone number' }
)
```

### Purchase confirmation
```typescript
const PurchaseSchema = z.object({
  wishlist_item_id: z.string().uuid()
})
```
Additional server-side checks:
- Item must exist and have `status='available'`
- Item must have `origin='external'` (catalog items go through checkout, not this endpoint)
- Buyer must be authenticated

---

## Error Handling

| Scenario | Handling |
|---|---|
| Wishlist not found or private | `notFound()` → 404. Never reveal "this is private" |
| Invalid invite token | `notFound()` → 404 |
| Inviting yourself | 400: "You can't invite yourself to your own wishlist" |
| Duplicate invite | 409: "You've already invited this person" |
| Race condition — item already purchased | 409 → show "Someone just claimed this — they got there first!" → redirect to wishlist |
| Item not available | 404: "This item is no longer available" |
| Purchase API — not authenticated | 401 → show auth gate sheet |
| Intent flag already set | 409: "Someone else has flagged this — you can still buy it" |
| Resend not configured | Log warning, still create the invite row, return success |
| Reminder opt-in fails | Log error, show success screen anyway — don't fail the whole purchase confirmation flow |

---

## Loading States

| State | Implementation |
|---|---|
| Shared wishlist page | Server rendered — use Suspense with skeleton header + skeleton items |
| Filter pill switch | Instant (client-side filter on pre-loaded data) |
| "Copy link" button | Instant clipboard write — show "Copied!" as feedback |
| "Send invite" button | "Sending…" + spinner while in flight |
| "Yes, I bought it" button | "Confirming…" + spinner, disabled until response |
| Reminder opt-in | "Saving…" + spinner |

---

## Empty States

| Context | Display |
|---|---|
| All items claimed | "Everything on this list has been gifted! 🎉" celebration message |
| Wishlist has no items | "This wishlist is empty — check back soon." |
| No invites sent | "No one invited yet" inside the invite list section |
| Invite email not sent (Resend not configured) | Internal log only — user sees success |

---

## Edge Cases the Agent Must Handle

1. **Public wishlist — no invite token** — the giver has no `wishlist_invites` row. If they opt into reminders on the success screen, create a `wishlist_invites` row for them first (with their `invitee_user_id` set) then create the reminders. Do NOT fail silently.

2. **Unauthenticated giver opens a friends-and-family wishlist token URL** — they can VIEW the wishlist (the token is the auth mechanism for viewing). When they try to buy, show the auth gate. After login, return them to the item they were trying to buy, not just the wishlist home.

3. **Item intent-flagged AND giver still buys it** — allowed. The intent flag is advisory. When the purchase is confirmed, the `on_purchase_created` trigger marks the item purchased and the intent flag becomes irrelevant (the item is no longer `available`). The cron will clean the flag eventually.

4. **Two givers confirm purchase simultaneously** — the `one_purchase_per_item` unique constraint on `purchases.wishlist_item_id` ensures only one succeeds. The second gets a 409. Handle gracefully with the "someone got there first" message.

5. **Receiver views their own shared link** — they should see their own name at the top which looks weird. Detect if the current user is the wishlist owner and show a banner: "You're viewing your wishlist as others see it" with a "Back to managing" link.

6. **Occasion date passes while giver is viewing the wishlist** — the countdown timer on the shared view is server-rendered. It won't update in real-time without a refresh. This is acceptable — don't overcomplicate it with real-time updates for v1.

7. **Price visibility toggled off** — ensure NO prices appear anywhere on the shared wishlist view or item detail, including in meta tags, JSON-LD, or page titles. The toggle must be airtight.

8. **`affiliate_url` is null** (no affiliate program for this retailer) — the "Buy this gift" button still works, redirecting to `product_url` directly with UTM params. Never show a broken or missing button.

---

## Analytics Events

```typescript
'wishlist.share_settings.opened'      // { wishlist_id }
'wishlist.visibility.changed'         // { from, to }
'wishlist.prices_visible.toggled'     // { now_visible: boolean }
'wishlist.invite.sent'                // { method: 'email' | 'phone' }
'wishlist.invite.revoked'             // {}
'wishlist.link.copied'                // {}
'shared_wishlist.viewed'              // { item_count, available_count, claimed_count, is_occasion, days_remaining }
'shared_wishlist.filter_changed'      // { filter: 'all' | 'available' | 'claimed' }
'shared_wishlist.item.viewed'         // { item_id, origin }
'shared_wishlist.item.buy_tapped'     // { item_id, origin }
'shared_wishlist.intent_flagged'      // { item_id }
'purchase.external.redirect'          // { item_id, domain, has_affiliate }
'purchase.external.confirmed'         // { item_id }
'purchase.external.declined'          // { item_id }
'purchase.external.race_condition'    // { item_id }
'reminder_optin.shown'                // { item_id }
'reminder_optin.accepted'             // { item_id }
'reminder_optin.declined'             // { item_id }
```

---

## Acceptance Criteria

- [ ] Changing wishlist visibility saves immediately (no separate save button) and takes effect on the shared URL instantly
- [ ] Toggling price visibility hides ALL prices from the shared view — no leakage
- [ ] Inviting by email creates a `wishlist_invites` row and sends a Resend email (or logs a warning if Resend is not configured)
- [ ] Revoking an invite immediately removes their access on next page load
- [ ] The shared wishlist view (`/w/[id]`) renders correctly for a valid public or friends-and-family link
- [ ] Private wishlists return 404 for anyone who is not the owner
- [ ] Invalid tokens return 404
- [ ] Available and claimed items are visually distinct — claimed items have no buy CTA
- [ ] Price visibility toggle is respected — prices are completely absent when toggled off
- [ ] An unauthenticated giver who taps "Buy this gift" sees the auth gate sheet and is returned to the item after logging in
- [ ] Confirming a purchase creates a `purchases` row, marks the item purchased, and triggers the automated thank-you (via the DB trigger)
- [ ] A race-condition double-purchase is caught at the DB constraint level and the second giver sees "someone got there first"
- [ ] The intent flag appears as an amber badge and does not prevent purchase
- [ ] Intent flags expire after 24 hours via the cron job
- [ ] The reminder opt-in on the success screen correctly creates `reminders` rows for the right occasion date
- [ ] The receiver viewing their own shared link sees the "viewing as others" banner

---

## What This Feature Does NOT Include

- Catalog item checkout — "Buy this gift" for catalog items stubs to `/checkout` (built in the Commerce feature spec)
- Thank-you message delivery — the DB trigger creates the record; Resend delivery is handled in the Thank You feature spec
- Reminder email delivery — creating the `reminders` rows is done here; actual email sending is in the Reminders feature spec
- Group gifting — the "Allow group payment" checkbox shown in the Figma designs is display-only. Do not wire it to any functionality.