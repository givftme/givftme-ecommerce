# Gifvtme — Agent Instructions

This file is the entry point for any AI coding agent working in this repository. Read it before making changes.

## Read order

1. `context/PROJECT_OVERVIEW.md` — what Gifvtme is, the three-transaction-flow architecture, v1 scope boundaries
2. `context/PRD.md` — why decisions were made, so you don't relitigate settled debates
3. `context/BUSINESS_RULES.md` — hard invariants, check before touching purchase/pricing/order/auth logic
4. `context/ROADMAP.md` — current build status, so you know what's actually done vs not started

Then the relevant deeper file depending on the task: `architecture/` for system/data/API questions, `design/` for UI questions, `engineering/` for code-level conventions.

## Non-negotiable scope boundaries

Do not build, without an explicit instruction to do so in this specific session:
- A custom admin dashboard (Retool is the intentional v1 operational interface)
- An in-app wallet or stored customer balance
- A social feed
- Automated supplier API integration (order forwarding is manual in v1)
- Multi-currency support (Naira only)
- Native mobile apps (web-first)

If a task description seems to imply one of these, stop and flag the conflict rather than proceeding. See `context/PROJECT_OVERVIEW.md` and `context/BUSINESS_RULES.md` rules 21–24.

## The two things to never get wrong

**1. `wishlist_items.origin`** (`external` | `catalog`) determines which of two completely separate transaction flows an item follows. Before writing any code touching purchases, checkout, or pricing, confirm which flow you're in. See `context/architecture/ARCHITECTURE.md` for the full flow breakdown.

**2. Price is always fetched server-side.** `getActivePrice()` in `lib/sanity/pricing.ts` is the single source of truth for any catalog item price — at checkout, at cart render, and at order creation. Never trust a client-provided price. Never use a wishlist snapshot price at checkout time.

## The three transaction flows

- **Flow A — External/Affiliate:** receiver adds scraped item → giver redirected to retailer via `affiliate_url` → giver confirms purchase on Gifvtme → `purchases` row created → `on_purchase_created` trigger marks item claimed + queues thank-you.
- **Flow B — Catalog/Commerce:** receiver adds catalog item → giver adds to cart → `POST /api/checkout` re-fetches Sanity prices → Flutterwave payment → webhook confirms → `orders` row at `confirmed` → ops team fulfils via Retool.
- **Flow C — Gift Pooling:** receiver or giver creates a pool → contributors pay immediately via Flutterwave → webhook increments `group_gift_pools.amount_raised` atomically → when fully funded, ops team procures (item pool) or receiver cashes out (general pool or any time).

These flows are permanently separate. Never mix them in one cart, one checkout, or one purchase record.

## Tech stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **UI components:** shadcn/ui (Radix-based, customised to brand — `rounded-full` buttons, `#C50404` brand red)
- **Icons:** lucide-react exclusively
- **Forms:** react-hook-form + Zod resolvers. Same Zod schema shared between API route and form where applicable.
- **Animation:** GSAP + @gsap/react. Use `useGSAP` hook only — never bare `useEffect` for GSAP. Client components only.
- **Database:** Supabase (PostgreSQL + Auth + RLS). `lib/supabase/client.ts` for browser, `lib/supabase/server.ts` for server components and routes.
- **CMS:** Sanity. All GROQ queries in `lib/sanity/queries.ts` — never inline. Use `getActivePrice()` from `lib/sanity/pricing.ts` for all pricing.
- **Payments:** Flutterwave (NGN only). Webhook signature must be verified before any state change.
- **Email:** Resend. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars.
- **Ops:** Retool connected directly to Supabase via service role. No custom admin UI.
- **Hosting:** Vercel.

## Working conventions

- Check `context/architecture/FOLDER_STRUCTURE.md` before creating a new file.
- Check `context/design/COMPONENT_LIBRARY.md` before building a new component — extend existing ones, never build separate mobile/desktop component files (one responsive component per concept).
- Check `context/architecture/API_ROUTES.md` before building a new API route, and update that file when you add or change one.
- Follow `context/engineering/CODING_STANDARDS.md` for TypeScript, import paths, server/client component splits, and naming.
- All prices in Naira, formatted via `formatPrice()` in `lib/utils.ts`.
- All GROQ queries in `lib/sanity/queries.ts` — never inline in a page or component.
- Use `cn()` from `lib/utils.ts` for all conditional class merging.
- Use `@/` path alias for all internal imports — never deep relative paths.

## Key design tokens (Tailwind v4 / CSS variables in globals.css)

| Token | Value | Usage |
|---|---|---|
| `brand` | `#C50404` | Primary buttons, active states, brand mark |
| `brand-dark` | `#A80303` | Hover on filled buttons |
| `brand-light` | `#FEF2F2` | Badge backgrounds, ghost hover |
| `ink` | `#000000` | Primary text |
| `muted` | `#4A4A4A` | Secondary text, captions |
| `surface` | `#F7F7F7` | Card backgrounds, disabled states |

Buttons are `rounded-full` (pill). Cards are `rounded-2xl`. Inputs are `rounded-xl`.

## Database — critical tables

| Table | Purpose |
|---|---|
| `wishlists` | Evergreen and occasion wishlists. `type` = `evergreen` \| `occasion`. `visibility` = `private` \| `friends_family` \| `public`. |
| `wishlist_items` | All items. `origin` = `external` \| `catalog`. `is_exclusive` for occasion-only items. `sort_order` for drag reorder. |
| `master_items` | Evergreen pool mirror of wishlist items. |
| `occasions` | Time-bound gifting events. `status` = `active` \| `archived`. |
| `purchases` | External flow only. `one_purchase_per_item` UNIQUE constraint. |
| `orders` | Catalog flow only. Full status machine with `on_order_status_changed` trigger. |
| `order_items` | Snapshotted price at purchase — never recalculated. |
| `group_gift_pools` | Gift pooling. `status` = `open` \| `fully_funded` \| `procured` \| `paid_out` \| `cancelled`. |
| `pool_contributions` | Individual payments into a pool. `status` = `pending_payment` \| `paid` \| `failed`. |
| `pool_payouts` | Ops team cash-out tracking. Manual bank transfer in v1. |
| `thank_you_messages` | Auto + personal. Exactly one of `purchase_id` or `order_id` set. |
| `reminders` | Flow 1 (important dates) and Flow 2 (invite opt-in). Cron-delivered. |
| `addresses` | Saved shipping addresses. Partial unique index: one default per user. |
| `reviews` | Verified-purchase only. `one_review_per_user_per_product` UNIQUE constraint. |
| `wishlist_invites` | Friends & family access tokens + Flow 2 reminder opt-in. |
| `order_status_history` | Append-only status log. `customer_notified` boolean. |

## Cron routes (all protected by `Authorization: Bearer ${CRON_SECRET}`)

| Route | Schedule | Purpose |
|---|---|---|
| `POST /api/reminders` | Every 15 min | Send due reminder emails |
| `POST /api/thank-you/process` | Every 5 min | Send pending auto thank-you emails |
| `POST /api/orders/notify` | Every 5 min | Send order status emails |
| `POST /api/occasions/archive` | Daily | Archive occasions 7+ days past their date |

## Feature specs location

All feature specs are in `context/features/`. See `context/features/INDEX.md` for the full list with statuses. 21 features total across 12 modules.

| Module | Folder |
|---|---|
| Identity | `01-identity/` |
| Wishlist Core | `02-wishlist-core/` |
| Sharing & Giving | `03-sharing-giving/` |
| Reminders | `04-reminders/` |
| Thank You | `05-thank-you/` |
| Gift Museum & Catalog | `06-museum-catalog/` |
| Commerce | `07-commerce/` |
| Fulfillment | `08-fulfillment/` |
| Reviews | `09-reviews/` |
| Flash Sales | `10-flash-sales/` |
| Account | `11-account/` |
| Gift Pooling | `12-gift-pooling/` |

## When you're unsure

Prefer asking a clarifying question over making an assumption when the ambiguity touches: money (pricing, payments, refunds, pool increments), data visibility (who can see what), or anything in `context/BUSINESS_RULES.md`. For lower-stakes ambiguity (spacing, copy wording), make a reasonable choice matching existing patterns and note the assumption.

## Keeping context current

If you complete a feature: update `context/ROADMAP.md`.
If you make a new architectural or product decision: add it to `context/PRD.md` or `context/BUSINESS_RULES.md`.
If you add an API route, component, or env variable: update the corresponding doc (`API_ROUTES.md`, `COMPONENT_LIBRARY.md`, `ENV_VARIABLES.md`).

These files are meant to stay accurate — stale documentation is as harmful as no documentation.