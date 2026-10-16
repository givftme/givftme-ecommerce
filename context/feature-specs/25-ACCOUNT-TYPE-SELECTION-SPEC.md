# Feature: Account Type Selection — Get Started Screen

## Overview
A fork-in-the-road screen at `/get-started` that every new user passes through before signing up. It presents two clear paths — Individual (personal wishlist and gifting) and Business (corporate gifting dashboard) — and routes them to the correct signup flow. Existing logged-in users are redirected away. All "Get started", "Sign up", and "Create account" CTAs across the platform link here instead of directly to `/auth/signup`.

---

## Goals
- Give every new user a clear, low-friction choice between the two account types.
- Prevent business users from accidentally landing in the consumer signup and vice versa.
- Give the platform a clean, canonical entry point suitable for ads and direct sharing.
- Carry the selected account type forward so the signup form knows what kind of account it is creating.

---

## User Stories
- As a new visitor, I land on `/get-started` and immediately understand the two types of account Gifvtme offers.
- As an individual, I click "For me" and arrive at the consumer signup form.
- As an HR manager, I click "For my business" and arrive at the business account creation form.
- As a returning logged-in user, clicking any "Get started" CTA redirects me to my dashboard — I never see the selection screen again.
- As a user who navigated directly to `/auth/signup`, I am redirected to `/get-started` first so I go through the correct path.

---

## Functional Requirements
1. Route: `/get-started` — public, no auth required.
2. Two selectable options: **Individual** and **Business**.
3. Selecting Individual → navigates to `/auth/signup?type=individual`.
4. Selecting Business → navigates to `/business-dashboard/auth?type=business`.
5. The `type` query param is read by each signup page to pre-configure the form (individual signup needs no change; business auth page uses it to default to the "Create account" tab).
6. Authenticated users who visit `/get-started` are redirected:
   - `account_type = 'consumer'` → `/dashboard/wishlists`
   - `account_type = 'business'` → `/business-dashboard`
7. The page is server-rendered (Next.js server component). The two option cards and their navigation are client components (need `onClick` for the hover/selection animation before navigating).
8. All existing "Get started", "Create account", and "Sign up" links across the app that currently point to `/auth/signup` are updated to point to `/get-started` instead. The only exception is the "Already have an account? Sign in" link on signup pages — those go directly to `/auth/login`.
9. `/auth/signup` — if reached without a `type` query param (i.e. someone navigated directly), redirect to `/get-started`. If reached with `?type=individual`, render the form normally.

---

## Non-Functional Requirements
- Page must load and be interactive in under 1.5 seconds.
- Must work with JavaScript disabled (server-rendered, navigation via plain `<a>` href fallback).
- The page is a valid landing page for paid ads — include correct OG meta tags.

---

## UI Requirements

### Layout
Full-viewport page. No site navbar or footer — this is a standalone entry screen. Just the Gifvtme logo at the top (centred, links back to `/`) and the two option cards centred vertically and horizontally.

### Structure (desktop)
```
[Logo — top centre]

[Heading: "What brings you to Gifvtme?"]
[Subtext: "Choose the account type that fits you best. You can always explore the other later."]

[Two cards side by side, max-width 640px total, gap 16px]

[Small "Already have an account? Sign in" link below cards]
```

### Structure (mobile)
Same content, cards stack vertically, full width minus padding.

### Individual card
- Background: white
- Top accent: 4px brand red top border
- Icon: large gift icon (Lucide `Gift`, 40px, brand red) inside a `brand-light` rounded square
- Heading: "For me"
- Sub-heading: "Personal wishlists & gifting"
- Description: "Create a wishlist for your birthday, wedding, or any occasion. Share it with friends and family so you always get gifts you actually want."
- Feature list (3 items, small checkmarks):
  - Create wishlists for any occasion
  - Share with friends and family
  - Receive gifts people know you'll love
- CTA button: "Create personal account" (filled, full width, brand red, `rounded-full`)
- Hover/focus state: `box-shadow: 0 8px 32px rgba(197,4,4,0.12)`, border becomes brand red

### Business card
- Background: `ink` (`#000000` / very dark)
- Text: white
- Icon: `Building2` (40px, white) inside a dark-slightly-lighter rounded square
- Heading: "For my business"
- Sub-heading: "Corporate gifting at scale"
- Description: "Manage birthdays, work anniversaries, and campaigns for your entire team. Branded cakes, hampers, and gift cards — delivered on the day."
- Feature list (3 items, small checkmarks in brand red):
  - Staff birthdays handled automatically
  - Branded packaging with your logo
  - One invoice, every delivery
- CTA button: "Create business account" (filled, white background, ink text, `rounded-full`)
- Hover/focus state: subtle white glow `box-shadow: 0 8px 32px rgba(255,255,255,0.08)`
- Small badge top-right of card: "For teams" (muted, small pill)

### Animation (GSAP `useGSAP`)
On mount: both cards animate in from below with a stagger.
```javascript
gsap.from([individualCard, businessCard], {
  y: 28,
  opacity: 0,
  duration: 0.5,
  stagger: 0.12,
  ease: 'power2.out',
})
```
On card click: brief scale-down before navigation (`scale: 0.97`, duration 0.15s) then `router.push()`.
Respect `prefers-reduced-motion` — skip animations if set.

### Logo
Gifvtme wordmark (same as navbar). Clicking takes the user to `/`. Below the logo, a very small "The Gift Museum" tagline in muted text.

### Sign-in link
Below the cards, centred:
"Already have an account? [Sign in →]" — links to `/auth/login`.

---

## Backend Logic

### Middleware update (`src/middleware.ts`)
Add `/get-started` to the redirect-if-authenticated check:
```typescript
if (pathname === '/get-started' && session) {
  const { data: profile } = await supabase
    .from('users').select('account_type').eq('id', session.user.id).single()

  if (profile?.account_type === 'business') {
    return redirect('/business-dashboard')
  }
  return redirect('/dashboard/wishlists')
}
```

### `/auth/signup` guard
Add to the top of `app/auth/signup/page.tsx`:
```typescript
const type = searchParams.type
if (!type || type !== 'individual') redirect('/get-started')
```

---

## Database Changes
None new. The `account_type` column on `public.users` was already added in the business dashboard migration:
```sql
-- Already exists from migration_admin.sql:
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT
  NOT NULL DEFAULT 'consumer'
  CHECK (account_type IN ('consumer','business'));
```
Consumer signups set `account_type = 'consumer'` (the default — no change needed).
Business signups set `account_type = 'business'` (already handled in the business dashboard auth flow per spec `16-business-dashboard`).

---

## API Endpoints
None. Pure navigation — no API calls on this page.

---

## Links to update across the codebase

Every occurrence of `href="/auth/signup"` or `href="/auth/signup"` in the following files must be changed to `href="/get-started"`:

| File | Current link | Update to |
|---|---|---|
| `src/components/layout/Navbar.tsx` | "Get started" CTA | `/get-started` |
| `src/app/page.tsx` | Any signup/get-started CTAs | `/get-started` |
| `src/app/business/page.tsx` | "Get started", "Talk to us" CTAs that lead to signup | `/get-started?hint=business` (pre-highlights the business card) |
| `src/app/auth/login/page.tsx` | "Don't have an account? Sign up" | `/get-started` |
| Any other "Sign up" or "Create account" links | `/auth/signup` | `/get-started` |

**Exception — do NOT change:**
- `src/app/auth/callback/route.ts` — internal OAuth callback, not a user-facing link
- Links that go to `/auth/login` — these stay as-is

### Optional: `?hint=business` query param
If the business page's "Get started" CTA passes `?hint=business`, the business card can be visually pre-highlighted on load (a subtle ring or slightly elevated shadow). This is a nice-to-have UX touch — implement only if time allows, does not affect routing logic.

---

## Permissions and Authorization
- Unauthenticated: full access to `/get-started`.
- Authenticated consumer: redirected to `/dashboard/wishlists`.
- Authenticated business user: redirected to `/business-dashboard`.

---

## Validation
No form inputs on this page — navigation only.

---

## Error Handling
None applicable — the page has no form submission or data fetching that can fail.

---

## Loading and Empty States
No loading state needed — the page is fully server-rendered. The client component for card animations mounts instantly. No empty states.

---

## Metadata (OG tags)
```typescript
export const metadata: Metadata = {
  title: 'Get Started — Gifvtme',
  description: 'Create your Gifvtme account. Build a personal wishlist for any occasion, or set up branded corporate gifting for your team.',
  openGraph: {
    title: 'Join Gifvtme',
    description: 'Personal wishlists or corporate gifting — choose the account that fits you.',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
}
```

---

## Edge Cases

1. **User navigates to `/auth/signup` directly (without `?type=individual`).** Redirect to `/get-started`. If they have a `redirect` param (e.g. `/auth/signup?redirect=/w/abc`), preserve it: redirect to `/get-started?redirect=/w/abc` so it's carried through to the eventual signup.

2. **User goes to `/get-started` with a `redirect` param** (e.g. they were sent here after trying to access a protected page). Carry the `redirect` param forward to the chosen signup URL: `/auth/signup?type=individual&redirect=/w/abc`.

3. **`?hint=business` param.** The business card gets a `ring-2 ring-brand` CSS class on initial render, drawing the eye. No JS required — applied server-side based on the searchParam. The animation still plays normally.

4. **User is mid-signup on one type and navigates back.** They land on `/get-started` again. This is correct — they can change their mind. No state to clear.

5. **User with a business account accidentally clicks "For me".** They land on `/auth/signup?type=individual` and could create a second consumer account. This is acceptable — nothing blocks creating multiple accounts in the current auth model. The business dashboard is only accessible to `account_type='business'` users.

---

## Analytics / Events
- `get_started.viewed` (hint: 'business' | null)
- `get_started.individual_selected`
- `get_started.business_selected`

Fire via `track()` from `lib/events/track.ts` client-side on card click.

---

## Testing Requirements

### Unit tests
- Middleware redirect logic: authenticated consumer → dashboard, authenticated business → business-dashboard, unauthenticated → renders page.
- `/auth/signup` guard: no `type` param → redirect to `/get-started`; `?type=individual` → renders form.

### Manual QA
- Visit `/get-started` while logged out → page renders with both cards.
- Visit `/get-started` while logged in as a consumer → redirected to `/dashboard/wishlists`.
- Visit `/get-started` while logged in as a business user → redirected to `/business-dashboard`.
- Click "Create personal account" → lands on `/auth/signup?type=individual`.
- Click "Create business account" → lands on `/business-dashboard/auth?type=business`.
- Visit `/auth/signup` directly (no query param) → redirected to `/get-started`.
- Visit `/auth/signup?type=individual` directly → renders signup form (no redirect).
- Visit `/get-started?hint=business` → business card is visually pre-highlighted.
- Verify all "Get started" CTAs across Navbar, homepage, and business page link to `/get-started`.

---

## Acceptance Criteria
- [ ] `/get-started` renders two option cards — Individual and Business — with no site navbar or footer.
- [ ] Clicking Individual navigates to `/auth/signup?type=individual`.
- [ ] Clicking Business navigates to `/business-dashboard/auth?type=business`.
- [ ] Authenticated consumers visiting `/get-started` are redirected to `/dashboard/wishlists`.
- [ ] Authenticated business users visiting `/get-started` are redirected to `/business-dashboard`.
- [ ] `/auth/signup` without `?type=individual` redirects to `/get-started`.
- [ ] All "Get started" / "Create account" / "Sign up" links across the app point to `/get-started`.
- [ ] GSAP entrance animation plays on mount (skipped if `prefers-reduced-motion`).
- [ ] `redirect` query params are preserved and carried through to the destination signup URL.
- [ ] OG meta tags are correct for the page.

---

## Future Improvements
- A third card: "I'm gifting someone" — for givers who arrive at Gifvtme from a shared wishlist link and want to create an account to track their gifts. Currently givers are just routed to the standard consumer signup.
- Animated illustration or short loop video between the two cards showing each use case.
- A/B test: two-card side-by-side vs a single "What do you want to do?" radio-button question (may reduce decision paralysis for less-savvy users).
