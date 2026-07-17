# Gifvtme — Authentication & Permissions

## Auth setup

Supabase Auth handles all authentication. Two sign-in methods in v1: email/password and Google OAuth. There is no separate auth system for internal operations — the internal team works through Retool, which connects to Supabase using the service role key, bypassing RLS entirely (this is expected and intentional for that one tool only).

Session handling: `lib/supabase/middleware.ts` refreshes the session on every request. `proxy.ts` redirects unauthenticated users away from protected dashboard route-group pages and redirects authenticated users away from `/login` and `/signup`.

A profile row in `public.users` is auto-created via the `handle_new_user` trigger whenever a new `auth.users` row appears — application code should never need to manually create a profile row after signup.

## Who needs an account, and when

Browsing the public shop, viewing a shared wishlist (if `public` or with a valid invite token), and viewing product pages all work without an account. **Marking any item as purchased — external or catalog — requires an account** (business rule #2), specifically to support the thank-you message system. Creating a wishlist, of course, requires an account.

## RLS policy rationale per table

**`users`** — a user can only select/update their own row. No public read access to other users' profiles.

**`wishlists`** — owners have full access. `public` wishlists are selectable by anyone (including anonymous/unauthenticated requests). `friends_family` wishlists are selectable only by users with a matching row in `wishlist_invites` (matched on `invitee_user_id` or `invitee_email` against the authenticated user). `private` wishlists are only selectable by the owner — there is no policy granting broader access, so they fall through to owner-only by default.

**`wishlist_items`** — same access logic as the parent wishlist, checked via a join. Owners get full CRUD; viewers (per the wishlist's visibility) get read-only.

**`purchases`** — a buyer can insert their own purchase record. A wishlist owner can see purchases on their own items (so they know what's been claimed); a buyer can see their own purchase history. No one else has access.

**`orders`** / **`order_items`** / **`order_status_history`** — a buyer can only see their own orders and the items/history within them. There is no customer-facing query path that should ever expose another user's order. Retool's service-role access for internal review bypasses RLS by design — do not attempt to replicate that access pattern in customer-facing API routes.

**`thank_you_messages`** — the sender (the wishlist owner) manages their own thank-you messages.

**`wishlist_invites`** — the inviter (wishlist owner) manages invites for their own wishlists. An invitee can view their own invite record (used to resolve `friends_family` wishlist access and to confirm reminder opt-in state).

**`important_dates`** / **`reminders`** — strictly owner-only, no sharing model at all.

**`group_gift_pools`** — no RLS policies defined yet, intentionally (business rule #15). Do not add customer-facing read/write policies to this table without an explicit decision to begin v2 group gifting work.

## Public vs authenticated route summary

| Route pattern | Auth required? |
|---|---|
| `/`, `/shop`, `/product/[slug]`, `/occasions/[slug]`, `/collections/[slug]` | No |
| `/w/[id]` (shared wishlist view) | No — but depends on wishlist visibility |
| `/w/[id]/item/[itemId]`, `/w/[id]/confirm/[itemId]` | Yes, to mark purchased |
| `/cart`, `/checkout` | Yes, to complete checkout |
| `/wishlists`, `/wishlists/*`, `/occasions`, `/occasions/*`, `/dates`, `/orders/*`, `/settings` | Yes |
| `/account/*` | Yes |
| `/login`, `/signup`, `/welcome`, `/onboarding` | No (redirects away if already authenticated) |
| `/callback`, `/forgot-password`, `/verify-otp`, `/reset-password`, `/success` | No |
| `/api/scrape` | Yes |
| `/api/occasions`, `/api/occasions/[id]`, `/api/occasions/[id]/items`, `/api/occasions/[id]/reactivate` | Yes |
| `/api/occasions/archive` | No user auth — protected by `Authorization: Bearer ${CRON_SECRET}` |
| `/api/flutterwave/webhook` | No user auth — verified via Flutterwave signature instead |
| `/api/reminders` | No user auth — protected by a cron secret header instead |

## A note on the shared wishlist link

The `/w/[id]` route resolves `id` as either a `wishlist_invites.token` or a raw `wishlists.id` (for public wishlists shared directly). This dual resolution is intentional — see `app/w/[id]/page.tsx`. Do not assume `id` is always one or the other.
