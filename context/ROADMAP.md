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
- Affiliate URL transformer (Jumia, Amazon, Konga)
- Microlink scraping integration (`/api/scrape`)
- Evergreen wishlist core — dashboard auto-creation, wishlist list/detail screens, add/edit/archive/reorder external items, manual image upload wiring, title editing, and owner-checked wishlist APIs
- Supabase schema migration 003 file — adds `sort_order` to `wishlist_items` and `master_items` (must still be applied to the Supabase project)
- Giver-facing UI mockups designed (shared wishlist view, item detail, purchase confirmation, claimed success) — not yet built as real pages, mockups only

### In progress / partially done
- Reminder system — scheduling logic exists (`lib/email/reminders.ts`, creates `reminders` rows), but `/api/reminders` marks reminders sent without actually sending email via Resend yet
- Context file system (this folder) — being built out
- Supabase Storage setup — `wishlist-images` bucket must be created with public read access, 5MB max size, and JPEG/PNG/WebP MIME limits before manual wishlist image uploads work

### Not started
- Reviews table/migration (referenced in `DATABASE_SCHEMA.md` as not yet in the migrations)
- Flash sale fields on the Sanity product schema (sale price, start/end time)
- `/api/checkout`, `/api/flutterwave/webhook`, `/api/orders/[id]/status`, `/api/purchases`, `/api/reviews` — not implemented
- Cart, checkout, order tracking, review, and flash sale UI components — folders exist, components not built
- Product detail page, variant selector
- Retool setup against production Supabase
- Sanity Studio deployment
- Actual Resend email sending (reminders, order status, thank-you messages)

## Explicitly deferred to v2 — do not build without an explicit decision

Group gifting payment flows, custom admin dashboard (Retool is the v1 interface), in-app wallet, native mobile apps, multi-currency support, automated supplier API integration, social feed.

## How to use this file

Before starting work on a feature, check whether it's listed as done, in progress, or not started here. If you complete something, move it to the correct section in the same edit. If you discover something listed as "done" is actually broken or incomplete, correct this file rather than leaving it inaccurate for the next session.
