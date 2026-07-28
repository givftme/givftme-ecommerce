# Feature: Email/Password & Google Signup/Login

## Overview
Entry point for all Gifvtme users. Supports two sign-in methods: email/password and Google OAuth. Required before any purchase-marking, wishlist creation, or checkout action (Business Rule #2). A Supabase `public.users` profile row is auto-created on signup via the `handle_new_user` trigger — application code never manually creates profiles.

On successful auth, users land at `/dashboard/wishlists`. Givers mid-flow (viewing a shared wishlist when they hit an auth wall) must be returned to the original wishlist URL after completing auth — not dumped at the dashboard.

---

## Goals
- Get users into an authenticated state with minimum friction.
- Support Google OAuth as a zero-form path.
- Ensure every authenticated user has a corresponding `public.users` profile row.
- Protect `dashboard/*` and `account/*` from unauthenticated access.
- Return users to their intended destination after auth, especially givers redirected from a wishlist link.

---

## User Stories
- As a new user, I can sign up with my email and a password so I can create a wishlist.
- As a new user, I can sign up with Google so I don't need to remember another password.
- As a returning user, I can log in and be taken directly to my dashboard.
- As a giver who was redirected to login mid-flow, after logging in I return to the wishlist I was viewing — not the dashboard.
- As a user who forgot my password, I can request a reset email and set a new password.
- As a logged-in user visiting `/auth/login`, I am redirected away to my dashboard.

---

## Functional Requirements
1. Email signup collects: full name, email, password.
2. Google OAuth collects no additional fields at sign-up time — name/email are pulled from the Google profile.
3. On email signup, Supabase sends a confirmation email. The user sees a "check your email" pending screen until confirmed.
4. `app/auth/callback/route.ts` handles the OAuth redirect and email-confirmation code exchange; on success redirects to `/dashboard/wishlists` (or the `redirect` query param if present).
5. The `handle_new_user` Postgres trigger fires on every new `auth.users` insert and creates a corresponding `public.users` row with `full_name` and `avatar_url` populated from metadata.
6. Middleware at `src/middleware.ts` redirects unauthenticated requests to `/auth/login?redirect=<original_path>` for protected routes.
7. Middleware redirects authenticated users away from `/auth/login` and `/auth/signup` to `/dashboard/wishlists`.
8. Password reset flow: request sends a Supabase reset email → user clicks link → `/auth/reset-password` page lets them set a new password → redirect to login on success.
9. No Apple Sign-In in v1 (explicit product decision — see `PRD.md`).
10. No birthday field at signup (explicit product decision — see `PRD.md`).

---

## Non-Functional Requirements
- Auth pages must load and be interactive in under 2 seconds on a 3G connection.
- All form interactions must be accessible via keyboard navigation.
- Passwords are never stored in application code — Supabase Auth owns credential storage entirely.
- Session cookies use `httpOnly` and `SameSite=Lax` as set by Supabase's `ssr` package.

---

## UI Requirements

### Onboarding slides (pre-signup)
Two slides shown before the signup form on first visit. GSAP-animated transitions between slides. "Get Started" CTA on slide 2 leads to signup. Skip option available. Imagery: warm, relationship-focused (Nigerian families/friends celebrating — see `design/DESIGN_SYSTEM.md` imagery guidance).

### Signup screen
Fields: Full name (text), Email (email input), Password (password input with show/hide toggle).
CTAs: "Create account" (filled button, full width), "Continue with Google" (ghost button, full width, Google icon via lucide-react or inline SVG).
Link at bottom: "Already have an account? Sign in"
Validation errors shown inline below each field.

### Login screen
Fields: Email, Password (with show/hide toggle).
CTAs: "Sign in" (filled), "Continue with Google" (ghost).
Link: "Forgot password?" → `/auth/forgot-password`
Link: "Don't have an account? Sign up"

### Email verification pending screen
Message indicating a confirmation email has been sent. Resend link (rate-limited: one resend per 60 seconds). No action possible until email is confirmed.

### Forgot password screen
Single field: email. "Send reset link" CTA. Confirmation message shown regardless of whether the email exists (security — don't enumerate accounts).

### Reset password screen
Fields: New password, Confirm new password. Inline match validation. "Set new password" CTA.

### Design specifics
- All auth pages use a split-panel layout on desktop: left panel is full-height imagery/brand, right panel is the form (per `design/RESPONSIVE_DESIGN_DIRECTIVE.md` rule on auth split panel).
- Mobile: full-screen form with logo at top.
- Buttons use the `filled` and `ghost` variants from `components/ui/button.tsx` (shadcn-based, styled to brand).
- Form built with `react-hook-form` + `zod` resolver.
- GSAP entrance animations on form elements on mount (stagger in from below, ~300ms, ease `power2.out`).

---

## Backend Logic

### `app/auth/callback/route.ts`
```
1. Extract `code` from query params.
2. Call supabase.auth.exchangeCodeForSession(code).
3. On success: redirect to `next` param if present and is a relative path, else `/dashboard/wishlists`.
4. On failure: redirect to `/auth/login?error=confirmation_failed`.
```

### `src/middleware.ts`
```
Protected route patterns: /dashboard/:path*, /account/:path*, /checkout/:path*, /api/wishlists/:path*, /api/purchases/:path*, /api/reviews/:path*, /api/checkout/:path*

On every request:
1. Run lib/supabase/middleware.ts to refresh the session.
2. If no session and route is protected → redirect to /auth/login?redirect=<pathname>.
3. If session exists and route is /auth/login or /auth/signup → redirect to /dashboard/wishlists.
```

### `handle_new_user` trigger (already in migration 001)
Fires on INSERT into `auth.users`. Creates a `public.users` row with `id = NEW.id`, `full_name = NEW.raw_user_meta_data->>'full_name'`, `avatar_url = NEW.raw_user_meta_data->>'avatar_url'`.

---

## Database Changes
No new tables. Uses existing `public.users` (created in migration 001).

Fields used:
- `id` — matches `auth.users.id`
- `full_name` — set from signup form or Google profile
- `avatar_url` — set from Google profile (null for email signups until updated in profile)
- `email` — stored for reference (display only — auth email is in `auth.users`)
- `created_at`

---

## API Endpoints
No custom Next.js routes for core auth — Supabase Auth client SDK handles signup/login/logout directly. Custom routes:

**GET/POST `/auth/callback`**
Handled by `app/auth/callback/route.ts`. Not a JSON API — performs a server-side redirect. No request body.

---

## Permissions and Authorization
- Unauthenticated users: can access all public routes, auth routes, shared wishlist pages.
- Authenticated users: cannot access `/auth/login` or `/auth/signup` — redirected to dashboard.
- All `public.users` RLS: a user can only SELECT/UPDATE their own row (`auth.uid() = id`).

---

## Validation

### Signup (Zod schema)
```typescript
const signupSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})
```

### Login (Zod schema)
```typescript
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})
```

### Reset password (Zod schema)
```typescript
const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine(data => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
})
```

---

## Error Handling

| Error | User-facing message |
|---|---|
| Email already registered | "An account with this email already exists. Sign in instead?" |
| Invalid credentials | "Incorrect email or password." (never specify which is wrong) |
| Email not confirmed | "Please confirm your email before signing in. Resend confirmation?" |
| Google OAuth failure | "Google sign-in failed. Please try again or use email." |
| Network failure | "Something went wrong. Please check your connection and try again." |
| Rate limit (Supabase) | "Too many attempts. Please wait a moment and try again." |

All errors display as inline form messages (below the submit button), not toast notifications.

---

## Loading and Empty States
- Submit buttons show a spinner and become disabled on form submission until the response resolves — use shadcn `Button` with a loading prop or manual `disabled` + spinner swap.
- Google OAuth button shows a spinner while the redirect is initiated.
- No empty states relevant to auth.

---

## Edge Cases

1. **Google account email matches an existing password account.** Supabase's default behavior links them. Verify this is the correct UX — if Supabase throws an error instead, display: "An account with this email already exists. Sign in with email instead."

2. **User clicks the email confirmation link after the token expires.** Supabase will reject the code. Show: "This confirmation link has expired. Request a new one." with a resend CTA.

3. **User signs up with Google but `raw_user_meta_data` contains no `full_name`.** The trigger will set `full_name = null`. The profile edit page should then prompt the user to add their name — check for null `full_name` on first dashboard load and show a dismissible banner.

4. **`redirect` param is an absolute URL or external domain.** Middleware must only honor relative paths — check that `redirect` starts with `/` before using it, otherwise fallback to `/dashboard/wishlists`. Prevents open redirect attacks.

5. **Resend confirmation email.** Rate limit at the form level (disable the resend button for 60 seconds after clicking) to reduce spam risk, in addition to Supabase's own rate limits.

6. **Session expires mid-checkout.** Middleware will redirect to login. The `redirect` param must capture the current checkout URL so the user returns after re-auth. Cart state (client-side) may be lost if stored in React state only — this is an accepted v1 limitation, but displaying "welcome back — your session expired" on the login page is good UX.

---

## Analytics / Events
Track the following events (can be implemented with a simple `lib/analytics.ts` wrapper — specific analytics platform TBD):

- `auth.signup.started` — user lands on signup page
- `auth.signup.completed` — successful signup (method: `email` | `google`)
- `auth.signup.failed` — error during signup (error_code)
- `auth.login.completed` — successful login (method: `email` | `google`)
- `auth.login.failed` — failed login attempt
- `auth.password_reset.requested`
- `auth.password_reset.completed`

---

## Testing Requirements

### Unit tests
- Zod schema validation: all valid and invalid input combinations for signup/login/reset schemas.

### Integration tests
- Email signup → confirmation → login flow end to end.
- Google OAuth callback route: success case (correct session), failure case (correct redirect).
- Middleware: unauthenticated access to protected route redirects correctly; authenticated access to auth routes redirects correctly.
- `handle_new_user` trigger: confirm a `public.users` row is created on every new `auth.users` insert, with correct `full_name` and `avatar_url`.

### Manual QA
- Sign up with email, confirm via real email, log in, verify dashboard loads.
- Sign up with Google, verify dashboard loads and profile row has correct name.
- Test "forgot password" end to end with a real email address.
- Test that a `redirect` param from a shared wishlist correctly returns a giver after login.
- Verify the `redirect` open-redirect guard blocks external URLs.

---

## Acceptance Criteria
- [ ] A new user can complete email/password signup, confirm their email, and reach an authenticated dashboard session.
- [ ] A new user can complete Google OAuth signup and reach a dashboard session without any form input.
- [ ] Every new user has a corresponding `public.users` row immediately after signup.
- [ ] An unauthenticated user attempting to access `/dashboard/*` is redirected to `/auth/login?redirect=<original_path>`.
- [ ] After login, a user is returned to the `redirect` path if present and valid, or to `/dashboard/wishlists` otherwise.
- [ ] An authenticated user visiting `/auth/login` is redirected to `/dashboard/wishlists`.
- [ ] Password reset sends an email and allows setting a new password end-to-end.
- [ ] All validation errors are shown inline, never as raw browser alerts.
- [ ] All auth forms are operable via keyboard navigation.

---

## Future Improvements
- Apple Sign-In (explicitly deferred from v1).
- Phone/SMS OTP login (common in Nigeria, high demand likely post-launch).
- "Remember this device" / extended session duration option.
- Two-factor authentication.
- Passkey/biometric login (for future native app).
