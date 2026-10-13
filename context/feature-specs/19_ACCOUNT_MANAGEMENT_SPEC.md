# Feature Spec: Account Management

**Project:** Givftme
**Module:** 11 — Account Management
**Priority:** Important
**Depends on:** Auth flow complete. Cart & Checkout complete (addresses used at checkout). Order Tracking complete (order list feeds from existing orders). Supabase migrations 001–003 running.
**Agent instruction:** Implement both UI and backend logic together. Apply `RESPONSIVE_DESIGN_DIRECTIVE.md` for desktop adaptation. Mobile screenshots are the design source of truth. Make reasonable decisions where unspecified and note in comments. Do not ask for clarification.

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
- **Path alias:** `@/` maps to `src/`

---

## Overview

The account section is the hub for everything personal — profile details, saved addresses, and order history. It is accessed via the "Account" tab in the bottom navigation on mobile and a dedicated section on desktop.

This feature covers three sub-features:

1. **Profile management** — name, avatar, phone, default thank-you message, sign out, delete account
2. **Address book** — save multiple shipping addresses, set a default, use at checkout
3. **Order history** — view all orders grouped by status, link to order detail pages

The `addresses` table does not yet exist in the schema and must be created in this feature. Everything else reads from existing tables.

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Account home | `/account` | Profile summary + nav links to sub-sections |
| Profile details | `/account/profile` | Edit name, avatar, phone, default thank-you message |
| Addresses | `/account/addresses` | List of saved addresses with add/edit/delete |
| Add/edit address | Sheet on `/account/addresses` | Address form |
| Order history | `/account/orders` | All orders in three status tabs |
| Order detail | `/account/orders/[id]` | Already built in Order Tracking spec — link to it |

---

## User Flows

### Updating profile
```
/account → Profile Details
→ Edit name, phone, default thank-you message
→ Upload avatar photo
→ Save → changes reflected immediately across the app
```

### Managing addresses
```
/account/addresses
→ See all saved addresses
→ "Add new address" → sheet opens → fill form → save
→ Address appears in list
→ At checkout: saved addresses available in a dropdown
```

### Viewing orders
```
/account/orders
→ Three tabs: Active | Completed | Cancelled
→ Each tab shows order cards
→ Tap "View Detail" → /account/orders/[id]
```

### Signing out
```
/account/profile → "Sign out" → confirms → signs out → redirects to /
```

### Deleting account
```
/account/profile → "Delete account" → confirmation dialog
→ Type "DELETE" to confirm → submits
→ All data deleted → signed out → redirects to /
```

---

## Detailed Screen Requirements

### Screen 1 — Account Home (`/account`)

**Layout:**
- Mobile: single column, profile card at top, nav list below
- Desktop: left sidebar (240px) with nav links, right content area

**Profile card (top):**
- Avatar (64px circle, initials fallback)
- Full name (bold, 18px)
- Email (muted, 14px)

**Navigation sections:**

**Personal:**
- Profile Details → `/account/profile`
- Addresses → `/account/addresses`
- My Orders → `/account/orders`
- Rewards → stub (shows "Coming soon" toast — not built in v1)

**Services:**
- Referrals → stub ("Coming soon")
- Coupon → stub ("Coming soon")

**Entertainment:**
- Games → stub ("Coming soon" — explicitly out of v1 scope per `BUSINESS_RULES.md`)

**More:**
- What's New → stub
- FAQ → `/faq` (if FAQ page is built)
- Legal → stub
- Get help → `/contact`

**Bottom tab nav:** Account tab is active.

---

### Screen 2 — Profile Details (`/account/profile`)

**Layout:**
- Mobile: full screen, single column, scrollable
- Desktop: centered card (max-width 560px)

**Header:**
- Back arrow → `/account`
- "Profile Details" title

**Avatar section:**
- Current avatar (80px circle) centered
- "Change photo" text link below — opens file picker
- "Remove photo" link (muted, smaller) — shown only if avatar exists

**Form fields (react-hook-form + Zod):**
- Full name — text input, required
- Email address — text input, shows current email, "Change email" link beside it that triggers Supabase `updateUser({ email })` flow (sends confirmation to new email)
- Password — shows "••••••••", "Change password" link that navigates to the forgot-password flow
- Birthday date — text showing the saved birthday (read-only display, not editable — simplified for v1 since birthday was removed from signup)
- Phone — text input, optional, Nigerian format

**Default thank-you message section:**
- Section header: "Default thank-you message"
- Helper text: "This message is sent automatically to anyone who buys you a gift."
- Textarea (max 300 characters, character counter)
- Pre-filled with current `users.default_thank_you_msg`

**"Save changes" button** (brand red, pill, full width)

**Danger zone (bottom of page):**
- Divider
- "Sign out" button — ghost, with `LogOut` icon (lucide-react)
  - On tap: calls `logout()` server action → redirects to `/`
- "Delete account" button — ghost, red text, with `Trash2` icon
  - On tap: opens confirmation dialog

**Delete account confirmation dialog:**
- Title: "Delete your account"
- Body: "This will permanently delete your account, wishlists, occasions, saved dates, and all associated data. This cannot be undone."
- Input: text field, placeholder "Type DELETE to confirm"
- "Delete my account" button (brand red) — enabled only when input value === "DELETE"
- "Cancel" button (ghost)
- On confirm: calls server action → redirects to `/`

---

### Screen 3 — Addresses (`/account/addresses`)

**Layout:**
- Mobile: single column, stacked address cards
- Desktop: centered content, max-width 640px

**Header:**
- Back arrow → `/account`
- "Addresses" title
- "Add new address" button (ghost, `+` icon, top right)

**Address cards:**

Each card:
- Label badge (e.g. "Home", "Office", "Default") — "Default" badge is brand red, others are muted grey
- Full name on the address
- Street address, city, state (formatted across 2–3 lines)
- Phone number
- Two icon buttons (right-aligned): edit (`Pencil`) and delete (`Trash2`)
- "Set as default" text link (muted, below the address) — only shown if NOT already the default

**Empty state:**
- `MapPin` icon (lucide-react, 80px, muted, inside `#FEF2F2` circle)
- "No saved addresses yet"
- "Add one for faster checkout."
- "Add address" button (brand red, pill)

---

### Screen 4 — Add / Edit Address (Bottom Sheet)

**Opens as:** shadcn/ui `Sheet` (bottom on mobile, centered dialog max-width 560px on desktop).

**Sheet title:** "Add new address" (add mode) / "Edit address" (edit mode)

**Form fields (react-hook-form + Zod, 2 columns on desktop where noted):**
- Label — text input, optional, placeholder "e.g. Home, Office, Mum's place", max 50 chars
- First name + Last name — side by side on desktop, stacked on mobile, both required
- Country / Region — pre-filled "Nigeria", locked (not editable in v1)
- Street address — text input, required, placeholder "House number and street name"
- Apt, suite, unit — text input, optional, placeholder "Apartment, suite, unit, etc. (optional)"
- City — text input, required
- State — dropdown of all 36 Nigerian states + FCT, required
- Phone — text input, optional, Nigerian format
- Postal code — text input, optional
- Delivery instructions — textarea, optional, max 500 chars
- "Set as default shipping address" checkbox
- "Set as default billing address" checkbox

**Save button:** "Save address" (brand red, pill, full width)
**Cancel button:** "Cancel" (ghost) — closes the sheet

---

### Screen 5 — Order History (`/account/orders`)

**Layout:**
- Mobile: single column, stacked order cards
- Desktop: centered content, max-width 800px

**Header:**
- Back arrow → `/account`
- "My Orders" title

**Status tabs:**
- **Active** — statuses: `pending_payment`, `confirmed`, `under_review`, `forwarded`, `shipped`
- **Completed** — status: `delivered`
- **Cancelled** — statuses: `cancelled`, `refunded`, `payment_failed`
- Tab labels include counts: "Active (3)", "Completed (12)", "Cancelled (1)"
- Active tab: brand-red underline

**Order cards:**

Each card:
- Order number: `#[first 9 chars of UUID uppercased]`
- Order date: "2 June 2025, 2:40 PM"
- Estimated delivery: "Est. delivery: 8 June 2025" (if set)
- Order status badge (colored):
  - Active: brand-red background, white text
  - `shipped`: amber background
  - `delivered`: green background
  - Cancelled/failed: grey background
- Item thumbnails: up to 3 circular thumbnails (40px each), "+N more" if more
- Item info: product name + colour/variant details (for the first item)
- Total: "₦29,000"
- "View Detail" button (ghost, small) → `/account/orders/[id]`

**"Leave a review" CTA on completed order cards:**
- Shown if at least one product in the order has not been reviewed by this user
- Small ghost button: "Leave a review" → `/reviews/new?product_id=[id]&order_id=[orderId]`

**Pagination:** 10 orders per tab. "Load more" button at bottom.

**Empty states (per tab):**
- Active: "No active orders"
- Completed: "No completed orders yet"
- Cancelled: "No cancelled orders"

**Overall empty (no orders):**
- `ShoppingBag` icon (lucide-react, 80px, muted, inside `#FEF2F2` circle)
- "You haven't placed any orders yet"
- "Browse the gift museum" button (brand red, pill) → `/shop`

---

## Backend Requirements

### Profile update

```typescript
// Server Action: updateProfile(formData)
const ProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
  default_thank_you_msg: z.string().max(300, 'Keep it under 300 characters').optional()
})

await supabase.from('users').update(validated).eq('id', userId)
```

### Avatar upload

```typescript
// Upload to Supabase Storage bucket 'avatars'
// Path: avatars/[userId]/avatar.[ext]
const { data } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.${ext}`, file, { upsert: true, contentType: file.type })

const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(data.path)

await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
```

### Account deletion

```typescript
// Server Action: deleteAccount()
// Uses service-role client — auth.admin.deleteUser requires it
const supabaseAdmin = createServiceClient()
await supabaseAdmin.auth.admin.deleteUser(userId)
// ON DELETE CASCADE on public.users handles all data cleanup
// Sign out and redirect to /
```

### Addresses CRUD

**`GET /api/addresses`** — returns user's addresses, default first
**`POST /api/addresses`** — creates address, handles default promotion
**`PATCH /api/addresses/[id]`** — updates address, handles default changes
**`DELETE /api/addresses/[id]`** — deletes address, auto-promotes new default

Default address management — when setting a new default:
```typescript
// Use a transaction-like approach:
// 1. Unset current default
await supabase.from('addresses')
  .update({ is_default: false })
  .eq('user_id', userId)
  .eq('is_default', true)

// 2. Set new default
await supabase.from('addresses')
  .update({ is_default: true })
  .eq('id', addressId)
  .eq('user_id', userId)
```

When deleting the default address:
```typescript
// After deleting, promote the most recently created remaining address as new default
const { data: remaining } = await supabase.from('addresses')
  .select('id')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (remaining) {
  await supabase.from('addresses')
    .update({ is_default: true })
    .eq('id', remaining.id)
}
```

### Order history query

```typescript
const STATUS_GROUPS = {
  active: ['pending_payment', 'confirmed', 'under_review', 'forwarded', 'shipped'],
  completed: ['delivered'],
  cancelled: ['cancelled', 'refunded', 'payment_failed']
}

const { data: orders, count } = await supabase
  .from('orders')
  .select(`
    id, created_at, status, total_amount,
    order_items(
      id, product_title, product_image_url,
      catalog_product_id, quantity
    )
  `, { count: 'exact' })
  .eq('buyer_id', userId)
  .in('status', STATUS_GROUPS[tab])
  .order('created_at', { ascending: false })
  .range(offset, offset + 9)
```

---

## Database Changes

### New `addresses` table — add to `gifvtme_migration_004.sql`

```sql
CREATE TABLE public.addresses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label                 text NOT NULL DEFAULT 'Home',
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  phone                 text,
  street_address        text NOT NULL,
  apt_suite_unit        text,
  city                  text NOT NULL,
  state                 text NOT NULL,
  postal_code           text,
  delivery_instructions text,
  is_default            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own addresses"
  ON public.addresses FOR ALL USING (auth.uid() = user_id);

CREATE INDEX ON public.addresses (user_id);
CREATE INDEX ON public.addresses (user_id, is_default) WHERE is_default = true;

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Supabase Storage bucket

Create `avatars` bucket (if not already created for profile management):
- Public read access: enabled
- File size limit: 5MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`

Note in a comment: this bucket must be created manually in the Supabase dashboard under Storage, or via the Supabase CLI.

---

## API Endpoints Summary

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/addresses` | List user's addresses | Required |
| `POST` | `/api/addresses` | Create address | Required |
| `PATCH` | `/api/addresses/[id]` | Update address | Required, must own |
| `DELETE` | `/api/addresses/[id]` | Delete address | Required, must own |
| `GET` | `/api/orders?tab=[active\|completed\|cancelled]&page=[n]` | List orders by status group | Required |

Profile updates and account deletion use Server Actions, not API routes.

---

## File Structure

```
src/
  app/
    account/
      page.tsx                      ← Account home (server component)
      profile/
        page.tsx                    ← Profile details (client component for form)
        actions.ts                  ← Server actions: updateProfile, deleteAccount
      addresses/
        page.tsx                    ← Address list (server component)
      orders/
        page.tsx                    ← Order history with tabs (server + client)
        [id]/
          page.tsx                  ← Already built in Order Tracking spec
    api/
      addresses/
        route.ts                    ← GET, POST
        [id]/
          route.ts                  ← PATCH, DELETE
      orders/
        route.ts                    ← GET (extend existing)
  components/
    account/
      AccountNav.tsx                ← Sidebar / list nav for account sections
      ProfileCard.tsx               ← Avatar + name + email summary card
      AvatarUpload.tsx              ← Avatar change/remove UI
      DeleteAccountDialog.tsx       ← Confirmation dialog with "DELETE" input
    address/
      AddressCard.tsx               ← Individual address card
      AddressSheet.tsx              ← Add/edit address bottom sheet
      AddressForm.tsx               ← The form fields (reused in checkout)
    order/
      OrderCard.tsx                 ← Already built in Order Tracking spec — reuse
      OrderTabs.tsx                 ← Active/Completed/Cancelled tab switcher
```

---

## Nigerian States List

```typescript
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
] as const

export type NigerianState = typeof NIGERIAN_STATES[number]
```

---

## Design System Reference

Same tokens as all previous specs.

**Order status badge colors:**
```typescript
const ORDER_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending_payment:  { bg: '#F3F4F6', text: '#374151', label: 'Awaiting Payment' },
  payment_failed:   { bg: '#FEE2E2', text: '#991B1B', label: 'Payment Failed' },
  confirmed:        { bg: '#FEF2F2', text: '#C50404', label: 'Confirmed' },
  under_review:     { bg: '#FEF2F2', text: '#C50404', label: 'Under Review' },
  forwarded:        { bg: '#FEF2F2', text: '#C50404', label: 'Processing' },
  shipped:          { bg: '#FEF3C7', text: '#92400E', label: 'Shipped' },
  delivered:        { bg: '#D1FAE5', text: '#065F46', label: 'Delivered' },
  cancelled:        { bg: '#F3F4F6', text: '#374151', label: 'Cancelled' },
  refunded:         { bg: '#F3F4F6', text: '#374151', label: 'Refunded' }
}
```

---

## GSAP Animations

| Element | Animation |
|---|---|
| Account nav items entrance | `gsap.from(items, { opacity: 0, x: -20, stagger: 0.05, duration: 0.3 })` |
| Address cards entrance | `gsap.from(cards, { opacity: 0, y: 20, stagger: 0.08, duration: 0.3 })` |
| New address added | `gsap.from(newCard, { opacity: 0, y: -20, duration: 0.4, ease: 'back.out(1.5)' })` |
| Address deleted | `gsap.to(card, { opacity: 0, height: 0, marginBottom: 0, duration: 0.3 })` |
| Order cards entrance | `gsap.from(cards, { opacity: 0, y: 20, stagger: 0.06, duration: 0.3 })` |
| Tab switch | `gsap.from(newTabContent, { opacity: 0, y: 10, duration: 0.2 })` |
| Avatar upload preview | `gsap.from(preview, { scale: 0.9, opacity: 0, duration: 0.3, ease: 'back.out(1.5)' })` |
| Delete account dialog open | Handled by shadcn/ui Dialog — no GSAP needed |

---

## Validation

### Profile update
```typescript
const ProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
  default_thank_you_msg: z.string().max(300, 'Keep it under 300 characters').optional()
})
```

### Address form
```typescript
const AddressSchema = z.object({
  label: z.string().max(50).default('Home'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  street_address: z.string().min(5, 'Enter your full street address'),
  apt_suite_unit: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.enum(NIGERIAN_STATES, { errorMap: () => ({ message: 'Select a state' }) }),
  phone: z.string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
  postal_code: z.string().optional(),
  delivery_instructions: z.string().max(500).optional(),
  is_default: z.boolean().default(false)
})
```

### Delete account confirmation
Client-side only: enable the "Delete my account" button only when the text input value is exactly `"DELETE"` (case-sensitive). No server-side validation of this string needed.

---

## Error Handling

| Scenario | Handling |
|---|---|
| Profile save fails | Toast: "Couldn't save changes. Try again." |
| Avatar file too large (>5MB) | Client-side rejection before upload: "Photo must be under 5MB" |
| Avatar wrong type | Client-side: "Please upload a JPG, PNG, or WebP image" |
| Avatar upload fails | Toast: "Couldn't upload photo. Try again." — do not block profile save |
| Account deletion fails | Dialog error: "Something went wrong. Contact support if this persists." |
| Add address fails | Toast: "Couldn't save address. Try again." |
| Delete default address (auto-promote fails) | Proceed with deletion, show toast "Address removed" — if promotion fails, user just has no default (acceptable) |
| Address not found | 404 |
| Address belongs to different user | 403 |
| Order not found | `notFound()` → 404 |
| No orders in a tab | Tab-specific empty state (not an error) |

---

## Loading States

| State | Implementation |
|---|---|
| Account home | Skeleton profile card + skeleton nav items |
| Profile details form | Pre-filled server-side — no loading state needed |
| Address list | Skeleton address cards (2–3 cards) |
| Save address button | "Saving…" + `Loader2` spinner, disabled |
| Delete address | Card fades out via GSAP, then removed from DOM |
| Order list | Skeleton order cards (3 cards per tab) |
| Load more orders | "Loading…" + spinner, new cards animate in |
| Avatar upload | Circular progress ring over existing avatar, replaced by new avatar on success |

---

## Edge Cases

1. **User has no avatar** — show initials-based avatar. First letter of `full_name` on a coloured circle. Colour derived consistently from user ID so it never randomly changes between page loads.

2. **User deletes all addresses** — checkout falls back to blank manual form entry. No error state.

3. **User deletes the only default address** — no default remains. At checkout, no address is pre-filled but the form is fully editable.

4. **Email change** — Supabase sends a confirmation to the new email. Until confirmed, the old email remains active. Show: "Confirmation sent to [new email] — check your inbox." on the profile page.

5. **Order with many items (10+)** — order card shows first 3 thumbnails + "+7 more". Detail page shows all items.

6. **Tab counts may be stale** — tab counts are computed at the time of the initial page load. If a new order is placed in another tab, the count won't update until a page refresh. Acceptable for v1.

7. **`pending_payment` orders older than 24 hours** — show in Active tab with "Awaiting Payment" badge. If older than 7 days, show in Cancelled tab instead with "Payment Expired" label. Implement with a computed `display_status` field that overrides `status` based on age.

8. **Address form used in checkout** — the `AddressForm` component must be shareable between the account address sheet and the checkout form. It is the same component, just rendered in different contexts.

---

## Analytics Events

```typescript
'account.profile.viewed'             // {}
'account.profile.updated'            // { fields_changed: string[] }
'account.avatar.uploaded'            // {}
'account.avatar.removed'             // {}
'account.account_deleted'            // {}
'account.signed_out'                 // {}
'account.addresses.viewed'           // { address_count: number }
'account.address.added'              // { is_default: boolean }
'account.address.edited'             // {}
'account.address.deleted'            // { was_default: boolean }
'account.address.set_default'        // {}
'account.orders.viewed'              // { tab, order_count }
'account.orders.load_more'           // { tab, page }
'account.orders.detail_opened'       // { order_id, status }
'account.orders.review_cta_clicked'  // { order_id }
```

---

## Acceptance Criteria

- [ ] `/account` shows the profile summary card and all nav links
- [ ] Profile name, phone, and default thank-you message can be updated and persist on refresh
- [ ] Avatar upload stores to Supabase Storage and appears immediately as the user's avatar across the app
- [ ] Account deletion requires typing "DELETE" and removes all data, signing the user out and redirecting to `/`
- [ ] `/account/addresses` shows all saved addresses with correct label and default badge
- [ ] Adding an address creates an `addresses` row and it appears in the list
- [ ] Setting a new default unsets the previous default — only one default at a time
- [ ] Deleting the default address auto-promotes another as the new default (if one exists)
- [ ] Address form is reusable — same component used in account and checkout
- [ ] `/account/orders` correctly groups orders into Active, Completed, and Cancelled tabs with correct counts
- [ ] Order cards show status badge, thumbnails, total, and "View Detail" link
- [ ] "Leave a review" CTA appears on delivered orders where the user has unreviewed products
- [ ] Pagination loads 10 more orders per "Load more" click without duplicating or skipping
- [ ] Empty states are shown correctly per tab when no orders exist in that group

---

## What This Feature Does NOT Include

- Wallet / stored balance — explicitly out of v1 scope (Business Rule #22)
- Referrals with real reward payouts — stub only in v1
- Games section — explicitly out of v1 scope (Business Rule #23)
- Two-factor authentication — v2
- Notification preferences management — v2
- Social profile / public profile — v2
