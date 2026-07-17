# Feature Spec: Authentication Flow

**Project:** Gifvtme
**Module:** Identity & Access
**Priority:** Core — must be completed before any other feature
**Agent instruction:** Implement both the UI and the backend logic together. The UI must match the exported Figma screens described in the UI Requirements section. Use the tech stack defined below. Do not ask for clarification — make reasonable implementation decisions where details are unspecified and note your assumptions in code comments.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components by default)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Icons:** lucide-react
- **Forms:** react-hook-form + Zod
- **Animation:** GSAP + @gsap/react
- **Auth provider:** Supabase Auth
- **Database:** Supabase (PostgreSQL with RLS)
- **Email:** Supabase Auth built-in email (for OTP and magic links)
- **Path alias:** `@/` maps to `src/`

---

## Overview

Gifvtme is a gifting platform. Users arrive at the homepage and can browse freely. The moment they attempt any action — adding to wishlist, buying a gift, creating an occasion — they are prompted to log in. If they have no account, they are directed to sign up.

The auth flow consists of eight screens implemented as a multi-step mobile-first experience. The flow handles: onboarding introduction, sign up, login, Google OAuth, forgot password, OTP verification, password reset, and success confirmation.

All auth screens live under the `app/(auth)` route group. The route group does not add a URL prefix, so auth URLs are top-level paths such as `/login` and `/signup`. The flow is modal-aware on desktop (can slide in over the page) and full-screen on mobile.

---

## Screens and Routes

| Screen | Route | Description |
|---|---|---|
| Onboarding slide 1 | `/onboarding` | First-time visitors only — two slides with brand imagery |
| Onboarding slide 2 | `/onboarding` (slide 2) | Auto-advances or tap to proceed |
| Welcome | `/welcome` | Split screen — Login or Sign up choice |
| Sign up | `/signup` | First name, last name, email, password |
| Login | `/login` | Email, password |
| Forgot password | `/forgot-password` | Email input to trigger OTP |
| OTP verification | `/verify-otp` | 6-digit numeric keypad, resend countdown |
| Reset password | `/reset-password` | New password + confirm password |
| Success | `/success` | "Password updated" confirmation |

---

## User Flows

### New user flow
```text
Homepage → attempts action → redirected to /login
→ taps "Sign up" → /signup
→ fills form → submits
→ Supabase sends verification email
→ user verifies email → session established
→ redirected back to original intended page (or /wishlists)
```

### Returning user flow
```text
Homepage → attempts action → redirected to /login
→ fills email + password → submits
→ session established → redirected back to original intended page
```

### Google OAuth flow
```text
/login or /signup → taps "Continue with Google"
→ Google OAuth consent screen
→ /callback → session established
→ redirected to /wishlists
```

### Forgot password flow
```text
/login → taps "Forgot Password?"
→ /forgot-password → enters email → submits
→ Supabase sends OTP to email
→ /verify-otp → enters 6-digit OTP
→ /reset-password → enters new password + confirm
→ submits → /success
→ taps "Done" → /login
```

### Action-gated prompt flow (unauthenticated user on homepage)
```text
User taps "Add to wishlist" / "Buy this gift" / any protected action
→ Toast or modal appears: "You need an account to do this"
→ Two CTAs: "Log in" | "Sign up"
→ After auth, user is returned to the action they were trying to take
```

---

## Detailed Screen Requirements

### Screen 1 & 2 — Onboarding

**When shown:** Only on first visit (track with `localStorage.setItem('onboarded', 'true')`). Skip entirely if already onboarded or if user is already authenticated.

**Layout:** Full screen. Single column. Large image top half, content bottom half.

**Slide 1:**
- Full-bleed image: warm Nigerian family celebration photo (use a placeholder image from `/public/images/onboarding-1.jpg` — agent should create a placeholder)
- Headline: "Simplifying Gift-Giving for all occasion"
- Subtext: "for Birthday, Weddings, Anniversaries, and Festivities"
- Pagination dots: 3 dots, first active (brand red pill, others grey circles)
- CTA button: "Get Started" (brand red, pill-shaped, full width)
- Below CTA: "Already have an account? **Login here**" (Login here is a link to `/login`)

**Slide 2:**
- Full-bleed image: warm Nigerian family photo (use `/public/images/onboarding-2.jpg`)
- Headline: "Welcome Home"
- Subtext: "for Birthday, Weddings, Anniversaries, and Festivities"
- Two buttons stacked:
  - "Login" (brand red, pill-shaped, full width)
  - "Sign up" (outline/ghost, pill-shaped, full width, brand red border and text)

**Slide transitions:** GSAP horizontal slide animation between slides. Swipe gesture support on mobile (use touch events).

**Navigation:** Tapping "Get Started" advances to slide 2. Tapping dots navigates to that slide. Back arrow on slide 2 returns to slide 1.

---

### Screen 3 — Welcome Screen

**Route:** `/welcome`

**Layout:** Full screen, centered content, white background.

- Back arrow (top left) — goes back to onboarding slide 2
- Large warm image top section (same as onboarding-2)
- Headline: "Welcome Home"
- Subtext: "for Birthday, Weddings, Anniversaries, and Festivities"
- "Login" button (brand red, pill, full width)
- "Sign up" button (ghost/outline, pill, full width)

**Note:** This screen is the same as onboarding slide 2. If the agent finds it cleaner to combine them, that is acceptable.

---

### Screen 4 — Sign Up

**Route:** `/signup`

**Layout:** Full screen. Single column. Scrollable.

**Header:**
- Back arrow (top left) — returns to welcome screen
- Page title: "Let's get you started"
- Subtext: "Tell us more about you, please use your name as it appears on your ID."

**Form fields (react-hook-form + Zod):**
1. First name — text input, placeholder "Enter your first name", required
2. Last name — text input, placeholder "Enter your last name", required
3. Email address — email input, placeholder "Enter your email", required, must be valid email format
4. Password — password input, placeholder "Enter your password", required, minimum 8 characters, show/hide toggle (eye icon from lucide-react)

**Primary CTA:** "Signup" button (brand red, pill, full width)

**Divider:** "or" text between two horizontal lines

**OAuth:**
- "Signup with Google" button — Google logo icon + text, outlined/ghost style, full width

**Footer:** "Already have an account? **Login**" — Login links to `/login`

**On submit (valid form):**
1. Call Supabase `signUp({ email, password, options: { data: { full_name: firstName + ' ' + lastName } } })`
2. Supabase sends a confirmation email automatically
3. Show a success message: "Check your email to verify your account" — then redirect to `/login`
4. The `handle_new_user` DB trigger auto-creates the `public.users` profile row

**Validation errors:** Show inline below each field. Do not show all errors at once — show on blur or on submit attempt.

---

### Screen 5 — Login

**Route:** `/login`

**Layout:** Full screen. Single column.

**Header:**
- Back arrow (top left) — returns to welcome or previous page
- Page title: "Welcome back home"
- Subtext: "Enter the necessary details"

**Form fields:**
1. Email address — email input, placeholder "Enter your email address", required
2. Password — password input, placeholder "Enter your email address" (note: placeholder in the Figma says this — keep it, but the field is for password), show/hide toggle, required
3. "Forgot Password?" — text link, right-aligned below the password field, links to `/forgot-password`

**Primary CTA:** "Login" button (brand red, pill, full width)

**Divider:** "or"

**OAuth:**
- "Continue with Google" button — Google icon + text, outlined style, full width

**Footer:** "Already have an account? **Signup**" — Signup links to `/signup`

**On submit (valid form):**
1. Call Supabase `signInWithPassword({ email, password })`
2. On success: redirect to the validated safe `redirect` URL param if present, otherwise `/wishlists`
3. On error: show global error banner above the form — "Incorrect email or password."

---

### Screen 6 — Forgot Password

**Route:** `/forgot-password`

**Layout:** Full screen. Single column.

**Header:**
- Back arrow (top left) — returns to `/login`
- Page title: "Forget Password"
- Subtext: "Enter the necessary details"

**Form fields:**
1. Email address — email input, placeholder "Enter your email address", required, valid email format

**Primary CTA:** "Continue" button (brand red, pill, full width)

**Footer:** "Already have an account? **Signup**" — links to `/signup`

**On submit:**
1. Call Supabase `signInWithOtp({ email, options: { shouldCreateUser: false } })` — this sends a 6-digit OTP to the email
2. Store the email in `sessionStorage` (key: `reset_email`) for use on the OTP screen
3. Navigate to `/verify-otp`
4. If email not found in Supabase: show error "No account found with this email address."

**Note on OTP approach:** Supabase's `signInWithOtp` sends a 6-digit OTP by default when the "Email OTP" option is enabled in the Supabase dashboard (Authentication → Email → Enable OTP). The agent must note in a code comment that the Supabase project needs "Email OTP" enabled, not just magic link, for this flow to work.

---

### Screen 7 — OTP Verification

**Route:** `/verify-otp`

**Layout:** Full screen. Single column.

**Header:**
- Back arrow (top left) — returns to `/forgot-password`
- Page title: "Verification"
- Subtext: "Please input the OTP sent to your Email address [email] to complete the registration process." — email is pulled from `sessionStorage.getItem('reset_email')`

**OTP display:** 
- Six individual boxes in a row showing each digit as entered
- NOT a standard text input — digits are entered via the custom numeric keypad below
- Filled boxes show the digit; empty boxes show a placeholder dot or border only
- Boxes animate in with a subtle scale/fade using GSAP when a digit is entered

**Resend link:**
- "Didn't get OTP? **Resend in 1:34s**"
- Countdown timer starts at 1:34 (94 seconds) when the screen loads
- While counting down: "Resend in MM:SS" — non-tappable, muted color
- When countdown reaches 0: "Resend OTP" becomes tappable (brand red link)
- Tapping resend: calls `signInWithOtp` again with the stored email, restarts countdown

**Custom numeric keypad:**
```text
[1] [2] [3]
[4] [5] [6]
[7] [8] [9]
    [0] [⌫]
```
- Each key is a large tappable button (minimum 64px height)
- Backspace (⌫) removes the last entered digit
- Keys have a press/active state (slight scale-down animation via GSAP)
- Automatically submits when 6 digits are entered (no manual Continue button — auto-advance)

**Continue button:**
- "Continue" (brand red, pill, full width)
- Disabled until 6 digits are entered
- Shows "Verifying…" with a spinner while the API call is in flight

**On 6 digits entered / Continue tapped:**
1. Call Supabase `verifyOtp({ email, token: otp, type: 'email' })`
2. On success: session is established (user is now logged in for the reset flow). Navigate to `/reset-password`
3. On error (wrong OTP): shake animation on the OTP boxes (GSAP), show error below: "That code is incorrect. Try again or resend."
4. On expired OTP: show error: "That code has expired. Request a new one."

---

### Screen 8 — Reset Password

**Route:** `/reset-password`

**Guard:** This page requires the user to have a valid session from the OTP verification step. If accessed directly without a session, redirect to `/forgot-password`.

**Layout:** Full screen. Single column.

**Header:**
- Back arrow (top left) — returns to `/verify-otp`
- Page title: "Reset Password"
- Subtext: "Enter your new password below."

**Form fields:**
1. Password — password input, placeholder "Enter your email address" (match Figma), show/hide toggle, required, minimum 8 characters
2. Confirm Password — password input, placeholder "Enter your email address" (match Figma), show/hide toggle, required, must match password field

**Primary CTA:** "Continue" button (brand red, pill, full width)

**On submit (valid form, passwords match):**
1. Call Supabase `updateUser({ password: newPassword })`
2. On success: clear `sessionStorage.reset_email`, navigate to `/success`
3. On error: show global error banner — "Couldn't update your password. Try again."

---

### Screen 9 — Success

**Route:** `/success`

**Layout:** Full screen. Single column. Centered vertically.

**Content:**
- Large success illustration or checkmark icon (use a large lucide-react `CheckCircle` icon in brand red, size 80px, inside a light brand-red circle background)
- Headline: "Successful"
- Subtext: "Your password has been updated."

**CTA:** "Done" button (brand red, pill, full width)

**On "Done" tap:** Navigate to `/login`

---

## Action-Gated Login Prompt (Homepage and Public Pages)

When an unauthenticated user attempts a protected action anywhere on the site:

**Trigger examples:**
- Tapping "Add to wishlist" on a product card
- Tapping "Buy this gift" on a shared wishlist item
- Navigating to dashboard route-group pages such as `/wishlists` or `/my-occasions/[id]` directly

**Behavior:**
- For direct URL navigation to protected dashboard pages: proxy redirects to `/login?redirect=[original-path]`
- For in-page actions (button taps): show a bottom sheet or modal with:
  - Title: "You need an account"
  - Body: "Sign in to add gifts to your wishlist, buy for others, and more."
  - "Log in" button (brand red, pill, full width)
  - "Create account" button (ghost, pill, full width)
  - Both buttons navigate to their respective auth routes with `?redirect=[current-path]`

**After successful auth:** redirect to the `redirect` param only after validating it as a same-origin relative path. Accept paths like `/wishlists`; reject absolute URLs, protocol-relative paths beginning with `//`, and raw or encoded backslash variants, falling back to `/wishlists`.

---

## Proxy Requirements

File: `proxy.ts`

**Protected routes** (redirect to `/login?redirect=[path]` if no session):
- `/wishlists`
- `/wishlists/*`
- `/my-occasions`
- `/my-occasions/*`
- `/dates`
- `/orders/*`
- `/settings`
- `/checkout`
- `/account/*`

**Auth-only routes** (redirect to `/wishlists` if session exists):
- `/login`
- `/signup`
- `/welcome`
- `/onboarding`

**Public routes** (always accessible — no redirect):
- `/`
- `/shop/*`
- `/product/*`
- `/occasions/*`
- `/collections/*`
- `/w/*`
- `/callback`
- `/forgot-password`
- `/verify-otp`
- `/reset-password`
- `/success`

---

## Database Requirements

### `public.users` table (already in migration 001)
On signup, the `handle_new_user` DB trigger automatically creates a row:
```sql
INSERT INTO public.users (id, full_name)
VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
```
The agent does not need to manually insert this row — the trigger handles it.

### No additional schema changes required for auth.

---

## Supabase Client Setup

The agent must use the correct Supabase client per context:

**Browser/client components:** `@/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Server components and route handlers:** `@/lib/supabase/server.ts` (already exists — use it as-is)

**Middleware:** `@/lib/supabase/middleware.ts` (already exists — use it as-is)

---

## Design System Reference

The agent must use these exact values — no deviation:

| Token | Value |
|---|---|
| Primary / brand color | `#C50404` |
| Brand hover | `#A80303` |
| Brand light (backgrounds) | `#FEF2F2` |
| Secondary text | `#4A4A4A` |
| Surface / input background | `#F7F7F7` |
| Font | Inter (loaded via `next/font/google`) |
| Button shape | Fully pill-shaped (`rounded-full`) |
| Input shape | `rounded-xl` |
| Input border | `border-stone-200` |
| Input focus ring | `ring-2 ring-[#C50404]/20 border-[#C50404]` |

**Button variants:**
- Filled: `bg-[#C50404] text-white hover:bg-[#A80303]`
- Ghost/outline: `border-[1.5px] border-[#C50404] text-[#C50404] bg-transparent hover:bg-[#FEF2F2]`

**shadcn/ui components to use:**
- `Button` (customised to pill shape)
- `Input`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` (react-hook-form integration)
- `Sheet` or `Dialog` for the action-gated login prompt

---

## File Structure

The agent should create or modify the following files:

```text
app/
  (auth)/
    layout.tsx              ← Auth layout wrapper (no navbar/footer)
    onboarding/
      page.tsx              ← Onboarding slides 1 & 2
    welcome/
      page.tsx              ← Welcome screen
    signup/
      page.tsx              ← Sign up form
      actions.ts            ← Server action for signup
    login/
      page.tsx              ← Login form
      actions.ts            ← Server action for login + Google OAuth
    forgot-password/
      page.tsx              ← Forgot password form
      actions.ts            ← Server action to send OTP
    verify-otp/
      page.tsx              ← OTP entry with custom keypad
      actions.ts            ← Server action to verify OTP
    reset-password/
      page.tsx              ← Reset password form
      actions.ts            ← Server action to update password
    success/
      page.tsx              ← Success screen
    callback/
      route.ts              ← OAuth + email confirmation callback (already exists)
proxy.ts                    ← Route protection (already exists, extend it)
components/
  auth/
    OtpKeypad.tsx           ← Custom numeric keypad component
    OtpDisplay.tsx          ← Six-box OTP display
    OnboardingSlider.tsx    ← Swipeable slide component
    AuthPromptSheet.tsx     ← Bottom sheet for action-gated login prompt
```

---

## Environment Variables Required

The agent should check these exist in `.env.local` and throw a clear error if missing:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

---

## Error States Reference

| Scenario | Message shown to user |
|---|---|
| Wrong email or password | "Incorrect email or password." |
| Email already registered | "An account with this email already exists. Try logging in." |
| Passwords do not match | "Passwords don't match." |
| Password too short | "Password must be at least 8 characters." |
| Email not found (forgot password) | "No account found with this email address." |
| Wrong OTP | "That code is incorrect. Try again or resend." |
| Expired OTP | "That code has expired. Request a new one." |
| Google OAuth failure | "Couldn't connect to Google. Please try again." |
| Generic server error | "Something went wrong. Please try again." |

All errors appear as:
- **Field-level errors:** below the relevant input field, small red text
- **Global errors:** a red banner above the form, dismissible

---

## Loading States

- Submit buttons show a `Loader2` spinning icon (lucide-react) + disabled state while any async call is in flight
- The OTP verify button shows "Verifying…" text
- Google OAuth button shows "Connecting…" after tap until the redirect fires

---

## GSAP Animation Requirements

Use `@gsap/react` `useGSAP` hook. All animations must be subtle — this is a premium gifting platform, not a game.

| Element | Animation |
|---|---|
| Onboarding slide transition | `gsap.to(currentSlide, { x: '-100%', duration: 0.4, ease: 'power2.inOut' })` simultaneously with new slide coming in from right |
| OTP digit entry | `gsap.from(box, { scale: 0.8, opacity: 0, duration: 0.15, ease: 'back.out(1.7)' })` |
| OTP error shake | `gsap.to(otpContainer, { x: [-8, 8, -6, 6, -4, 4, 0], duration: 0.4, ease: 'power2.inOut' })` |
| Screen entrance | `gsap.from(pageContent, { opacity: 0, y: 20, duration: 0.3, ease: 'power2.out' })` on each auth screen mount |
| Success checkmark | `gsap.from(checkIcon, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)' })` |

---

## Acceptance Criteria

The agent's implementation is complete when all of the following pass:

- [ ] A new user can sign up with first name, last name, email, and password and receive a verification email
- [ ] A returning user can log in with email and password and reach `/wishlists`
- [ ] Google OAuth completes the full flow and creates a `public.users` profile row
- [ ] An unauthenticated user accessing protected dashboard pages is redirected to `/login?redirect=[path]` and returned after login
- [ ] The forgot password flow sends an OTP to the user's email
- [ ] The OTP screen accepts 6 digits via the custom keypad and verifies correctly
- [ ] An incorrect OTP shows a shake animation and an error message
- [ ] The resend countdown starts at 1:34 and enables resend when it reaches 0
- [ ] The reset password form validates that both fields match before submitting
- [ ] A successful password reset lands on the success screen and "Done" navigates to login
- [ ] All screens match the design system (brand red `#C50404`, Inter font, pill-shaped buttons, `rounded-xl` inputs)
- [ ] GSAP animations are present on slide transitions, OTP entry, error shake, and screen entrances
- [ ] No Apple sign-in button appears anywhere
- [ ] No birthday field appears anywhere
- [ ] The onboarding screens are skipped for returning visitors (localStorage check)

---

## Notes for the Agent

1. **OTP via Supabase:** The forgot password flow uses `signInWithOtp` (email OTP mode), not a magic link. The Supabase project must have "Enable Email OTP" turned on in Authentication settings. Add a comment in `forgot-password/actions.ts` noting this requirement.

2. **Session after OTP:** After `verifyOtp` succeeds, Supabase establishes a session automatically. The reset password screen uses `updateUser` on this session. The middleware must NOT redirect the reset-password page to login — it needs to remain accessible with the OTP-established session.

3. **`redirect` param handling:** The `redirect` query param must be preserved through the entire auth flow. If a user lands on login with `?redirect=/wishlists`, after successful login they must end up at `/wishlists`, not the default.

4. **Server Actions vs client calls:** Use Server Actions (files named `actions.ts`) for signup and login form submissions. Use direct Supabase client calls from client components for the OTP keypad (since it's entirely client-side interaction) and Google OAuth.

5. **`"use client"` placement:** The OTP keypad, onboarding slider, and the countdown timer all require `"use client"`. Keep server components as the default — only mark as client where interactivity is required.

6. **Form validation:** All forms use `react-hook-form` with a Zod resolver. Validate on blur for individual fields, on submit for the full form. Never show all errors simultaneously before the user has interacted.

7. **Placeholder images:** Create placeholder files at `public/images/onboarding-1.jpg` and `public/images/onboarding-2.jpg`. Use a solid brand-red rectangle as a placeholder if no real images are available — the agent should not block on this.
