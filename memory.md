# Memory — Auth Flow Implementation

Last updated: 2026-07-10 16:02 +01:00

## What was built

- Implemented `context/feature-specs/01-auth-flow.md` in the repo's root-level `app/`, `components/`, and `lib/` structure rather than a `src/` structure.
- Added auth dependencies: Supabase SSR/client packages, `react-hook-form`, `@hookform/resolvers`, direct `zod`, and Radix dialog/label primitives.
- Added Supabase/env/auth plumbing: `lib/env.ts`, `lib/auth/redirect.ts`, `lib/auth/validation.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`.
- Added Next 16 route protection in `proxy.ts` for `/dashboard/*`, `/checkout`, and `/account/*`, plus auth-only redirects for login/signup/welcome/onboarding.
- Built auth routes under `app/auth/`: onboarding, welcome, signup, login, forgot-password, verify-otp, reset-password, success, and callback.
- Built auth UI components under `components/auth/`: animated auth shell, onboarding slider, welcome panel, form inputs, password toggle, Google OAuth button, OTP display/keypad, alert, divider, and auth prompt sheet.
- Added shadcn-style local primitives: `components/ui/Input.tsx`, `components/ui/Form.tsx`, `components/ui/Label.tsx`, `components/ui/Sheet.tsx`.
- Created required onboarding assets: `public/images/onboarding-1.jpg` and `public/images/onboarding-2.jpg`.
- Wired unauthenticated homepage wishlist taps in `app/_components/home/ProductSection.tsx` to show the auth prompt sheet.
- Updated `context/ROADMAP.md`, `context/design/COMPONENT_LIBRARY.md`, `context/architecture/API_ROUTES.md`, and `ui-registry.md`.

## Decisions made

- Used `proxy.ts` instead of `middleware.ts` because the local Next 16 docs say Middleware is now Proxy. The behavior matches the auth spec, but the filename intentionally follows the current framework convention.
- Reused the existing Gifvtme `Button`/design tokens and added compatible shadcn-style primitives instead of introducing a parallel visual system.
- Forgot password OTP uses Supabase `signInWithOtp`; the Supabase project must have Email OTP enabled in the dashboard for the 6-digit code flow.
- Google OAuth is triggered from the client with Supabase and returns through `app/auth/callback/route.ts`, preserving a safe relative `redirect` param.
- ProductSection wishlist behavior is auth-gated now, but authenticated users still get the existing local-only toggle until the real wishlist persistence feature is built.

## Problems solved

- `npm run lint` initially caught React 19 rules around synchronous state updates in effects; fixed in `AuthAlert` and `VerifyOtpScreen`.
- `npx tsc --noEmit` initially caught GSAP typings for OTP shake keyframes; kept the requested animation and narrowed the cast at that property.
- Verified no Apple sign-in button and no birthday field are present in the auth implementation.
- Production build is blocked by `next/font/google` fetching Inter from Google Fonts in the restricted network. Lint and TypeScript pass; `npm run build` failed/timed out due font network access, not a surfaced code/type error.

## Current state

- Auth UI and backend actions are implemented and type-check.
- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` still needs to be rerun in an environment where Next can fetch Google Fonts, or the project needs a local/self-hosted Inter strategy.
- Live Supabase auth flows were not end-to-end tested here because they require project credentials, Google OAuth setup, and Email OTP enabled in Supabase.
- `.env.local` exists but no secrets or values were read into this memory.

## Next session starts with

Read `/remember restore`, then AGENTS/context in order. The user has `context/feature-specs/02-evergreen-whishlist-spec.md` open, so the likely next task is the evergreen wishlist feature. Before building it, read the feature spec plus the deeper architecture/design/engineering docs it touches, especially database/auth permissions and folder/component conventions. Keep `wishlist_items.origin` separate for external vs catalog flows.

## Open questions

- If an automated checker expects `middleware.ts` specifically from the spec, decide whether to add a compatibility wrapper or keep only `proxy.ts` per Next 16 docs.
- Confirm Supabase dashboard has Email OTP enabled before testing forgot-password.
- Decide whether to keep `next/font/google` for Inter and require network at build time, or move to a local font asset to make builds deterministic offline.
