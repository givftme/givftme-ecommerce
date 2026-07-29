# Gifvtme — Roadmap & Build Status

This file should be updated frequently — at minimum every time a feature moves from "not started" to "in progress" to "done." Agents should check here before assuming something is or isn't built yet.

## Build sequence (4-month plan, see `architecture/ARCHITECTURE.md`)

**Month 1 — Foundation.** Supabase schema, Sanity schema, auth, manual-entry wishlist creation.
**Month 2 — Core gifting loop.** Scraping, occasion wishlists, sharing, affiliate purchase marking.
**Month 3 — E-commerce & engagement.** Catalog browsing, cart, Flutterwave checkout, order tracking, flash sales, reminders, thank-you messages.
**Month 4 — Reviews, polish, launch.** Reviews, group gifting data model only, responsive polish, bug fixing, soft launch.

## Current status (update this section as work progresses)

### Done
- Supabase schema — migration 001 (core wishlist/occasion/reminder/purchase tables) and migration 002 (e-commerce additions: orders, order_items, order_status_history, origin fields)
- Sanity schema — supplier, occasion, collection, product (with hybrid simple/complex variant model)
- Auth — signup, login, callback, email verification page, middleware-based route protection
- Auth flow spec 01 — mobile-first onboarding, welcome, signup, login, Google OAuth, forgot password OTP, reset password, success screens, Supabase auth actions, and Next 16 `proxy.ts` route protection
- Next.js app scaffold — full route structure for dashboard, shop, account, giver-facing wishlist views
- Shared component library foundation — Button, Badge, PriceDisplay, QuantityStepper, ProductCard, ProductGrid, Navbar, Footer, MobileBottomNav, PageWrapper
- Home page — fetches occasions and featured products from Sanity, renders via ProductGrid
- Gift museum/catalog browsing — homepage flash sale/occasion/featured sections, `/occasions`, `/occasions/[slug]`, `/collections/[slug]`, `/shop`, `/search`, `/product/[slug]`, cart context, variant selector, product image gallery, related products, catalog add-to-wishlist, and newsletter capture
- Cart and Flutterwave checkout — `/cart`, `/checkout`, `/checkout/processing`, `/checkout/failed`, `/account/orders/[id]`, `/api/cart/prices`, `/api/checkout`, `/api/checkout/retry`, and `/api/flutterwave/webhook` for catalog-only orders with server-fetched Sanity price snapshots and verified webhook confirmation
- Sanity catalog schema files — supplier, occasion, collection, product, attribute option, variant attribute, product variant, including flash sale fields
- Affiliate URL transformer (Jumia, Amazon, Konga)
- Microlink scraping integration (`/api/scrape`)
- Evergreen wishlist core — dashboard auto-creation, wishlist list/detail screens, add/edit/archive/reorder external items, manual image upload wiring, title editing, and owner-checked wishlist APIs. Add-item dialog now has URL/Manual tabs wired to `/api/scrape` (Fetch → editable preview → auto fallback to manual on failure/timeout); catalog adds re-fetch title/image/price from Sanity server-side rather than trusting the client; item edits now sync evergreen `master_items` in addition to `wishlist_items`.
- Supabase schema migration 003 file — adds `sort_order` to `wishlist_items` and `master_items` (must still be applied to the Supabase project)
- Sharing and giver flow core — receiver share settings sheet, visibility/price auto-save, invite management with Resend email fallback, `/w/[id]` shared wishlist view, giver item detail, external purchase confirmation, claimed success, intent flagging, invitee reminder opt-in, `/api/purchases`, and `/api/reminders`
- Supabase schema migration 006 file — adds intent flags, invite helper policies/functions, and shared wishlist resolver (must still be applied to the Supabase project)
- Supabase schema migration 007 file — adds `newsletter_subscribers` for catalog discount/newsletter capture (must still be applied to the Supabase project)
- Profile management — `/account/profile` page: name/phone/avatar/default thank-you message editing, "add your name" banner, sign out, and DELETE-confirmation account deletion (blocked while an order is active). Navbar now threads `avatar_url` through for the account link.
- Supabase schema migration 008 file — adds `users.phone`, extends column grants for `avatar_url`/`phone`, and creates the public `avatars` Storage bucket with owner-folder policies (must still be applied to the Supabase project)
- Occasion wishlist — 3-step creation (`/my-occasions/new`), pull-from-evergreen and exclusive-item flows, occasion detail page (`/my-occasions/[id]`) with edit/share/archive, manual + daily-cron auto-archive, and evergreen `master_items` reactivation after an occasion archives. Dashboard occasions section (on `/wishlists`) now splits into an active list and a collapsible "Past occasions" section, and the edit-occasion dialog notes that reminders will be rescheduled on a date change.
- Occasion reactivation prompts — Supabase schema migration 009 file adds `occasion_prompts` (applied to the Supabase project); archiving an occasion (manual or cron) best-effort creates a prompt row when it has purchased evergreen items, surfaced as a dashboard-wide `ReactivationPromptsBanner` on `/wishlists` in addition to the existing per-occasion prompt. Resolving via `/api/occasions/[id]/reactivate` marks the prompt resolved; the daily archive cron also auto-resolves prompts left unresolved for 30+ days (items stay purchased either way).
- Supabase schema migration 010 file — fixes a `WITH ORDINALITY` + column-definition-list syntax bug in migration 005's `gifvtme_create_occasion_with_wishlist` (only surfaces at execution time, not at function creation, so it shipped silently) that made occasion creation fail with a 500 (applied to the Supabase project; occasion creation confirmed working)

### In progress / partially done
- Reminder system — owner and invitee scheduling logic creates `reminders` rows, but `/api/reminders` only leaves due rows queued as deferred handoff until actual email/push delivery is built
- Context file system (this folder) — being built out
- Supabase project setup — migrations 003, 004, 005, 006, 008 and the private `wishlist-images` bucket with owner-folder storage policies must be applied/created before wishlist reorder, sharing, auto-creation, manual image uploads, and profile avatar/phone editing fully work (009 and 010 are applied) (009 is applied)

### Not started
- Reviews table/migration (referenced in `DATABASE_SCHEMA.md` as not yet in the migrations)
- `/api/orders/[id]/status`, `/api/reviews` — not implemented
- Full order tracking, review submission, and dedicated flash sale page UI
- Retool setup against production Supabase
- Sanity Studio deployment
- Actual Resend email sending for reminders, order status, and thank-you messages

## Explicitly deferred to v2 — do not build without an explicit decision

Group gifting payment flows, custom admin dashboard (Retool is the v1 interface), in-app wallet, native mobile apps, multi-currency support, automated supplier API integration, social feed.

## How to use this file

Before starting work on a feature, check whether it's listed as done, in progress, or not started here. If you complete something, move it to the correct section in the same edit. If you discover something listed as "done" is actually broken or incomplete, correct this file rather than leaving it inaccurate for the next session.
