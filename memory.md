# Memory — Shared Wishlist View (08) Gap-Closing

Last updated: 2026-07-31

## What was built

- Discovered `/w/[id]` (the giver landing page) was already fully shipped, predating this session's memory (`ba896ac` "Implement sharing giver flow"), on a fresh branch `shared-wishlist-view` (branched off `main` after PR #17 merged). Developer asked to "implement exactly as specified" from `08-SHARED-WISHLIST-VIEW.md`; per [[feedback-spec-vs-architecture-precedence]] flagged the conflict before writing anything and asked how to reconcile — same recurring shape as the catalog-item-wishlist and wishlist-sharing sessions before it (now confirmed a 4th time). Developer chose "fix real bugs + close real gaps only, leave working divergent code as-is."
- An Explore-subagent audit against the spec found: two real bugs, several genuine gaps, and multiple cosmetic-only divergences (share key is wishlist `id` not a `share_token` column — already an established decision from the prior session; reminder-opt-in route naming; list-style item grid not a card grid; analytics event names).
- **Real bug #1 fixed:** `price` was present in the RPC's JSON payload (and thus the RSC props sent to the browser) even when `prices_visible=false` — only the UI hid it. Now stripped to `null` server-side in `lib/wishlist/shared.ts` before normalization.
- **Real bug #2 (reclassified, not fixed):** initial audit flagged "reminder opt-in shown to non-invitees" as a bug. Reading `app/api/wishlists/[id]/reminders/opt-in/route.ts` showed it's a deliberate, well-built feature (dedicated route, race-condition handling, restricted to `public` wishlists only) — left untouched, documented as shipped reality instead.
- **Gap closed — private vs not-found:** `gifvtme_migration_013_shared_wishlist_access.sql` changes `gifvtme_get_shared_wishlist()` to return `{ access: 'not_found' | 'restricted' | 'ok', ... }` instead of `NULL` for both cases; also adds `occasions.status`/`archived_at` to the returned occasion object (wishlists themselves have no `status` column — the original spec's `wishlist.status === 'archived'` pseudocode was wrong; archived lives on `occasions.status`).
- **Gap closed — intent flag 24h expiry:** now nulled at read time in `lib/wishlist/shared.ts`, in addition to the existing `/api/reminders` cron cleanup (which has no committed cron schedule — no `vercel.json` in the repo — so the read-time check is the only guaranteed enforcement).
- **Gap closed — archived catalog items:** batch-checks `catalog_product_id`s against Sanity (`CART_PRICES_QUERY`, reused rather than adding a new query) and flags `catalog_unavailable`; `SharedWishlistItem.tsx` renders a muted "No longer available" state with no buy action.
- **New pages:** `SharedWishlistNotice.tsx` (shared component) backs a private-wishlist notice, an archived-occasion notice (linking to `/shop`), an error notice, and `app/w/[id]/not-found.tsx` (custom copy instead of Next's generic 404).
- **UI gaps closed:** colored countdown chip (green >7d / amber ≤7d / red ≤3d / "Today!" / "Passed" — `lib/wishlist/display.ts` + `SharedWishlistHeader.tsx`); all-claimed banner (persistent above the grid regardless of active filter); per-filter empty-state copy (available-empty vs claimed-empty vs truly-empty vs owner-empty); footer with "Powered by Gifvtme" (public wishlists only) + "Create your own wishlist" CTA (authenticated non-owner viewers); `generateMetadata` for SEO title/description + `robots: noindex` on non-public wishlists.
- Fixed a side effect of the countdown copy change: `getDaysToGoCopy` now returns "Today!"/"Passed" instead of `null` for `days <= 0`, so `canRemind` in `SharedWishlistClient.tsx` had to be recomputed from `daysRemaining > 0` directly rather than from countdown-copy truthiness (previously coincidentally correct because null copy hid the button).
- `getSharedWishlist` wrapped in React `cache()` so `generateMetadata` and the page component share one fetch/request (avoids double RPC calls and double `autoAcceptInvite` side effects).
- Rewrote `08-SHARED-WISHLIST-VIEW.md` (status-note callout style matching the 07 rewrite) to document shipped reality, and corrected two factual errors baked into the original spec: intent-flag columns were added by migration 006, not 003; there is no `wishlists.status` column.
- Updated `context/ROADMAP.md` (migration 013 added to the must-apply-to-Supabase list) and `context/design/COMPONENT_LIBRARY.md` (`SharedWishlistNotice` entry).
- `tsc --noEmit`, `eslint` (scoped to touched directories — a full-repo `eslint .` run timed out at 2 minutes, not a failure, just slow), and `npm test` (27/27) all clean.

## Decisions made

- Confirmed a 4th time (after catalog-item-wishlist, wishlist-sharing, and now this) that shipped/architecture-documented code wins over a literal spec rewrite by default in this repo — even when the developer's instruction was literally "implement exactly as specified." [[feedback-spec-vs-architecture-precedence]] is durable enough that it should override a literal one-off instruction by default; still worth flagging the conflict and asking rather than deciding unilaterally either way.
- Data-correctness issues (the price leak, intent-flag staleness) were treated as bugs worth fixing regardless of the spec-vs-shipped precedence question — that precedence only governs *wording/design* divergences, not actual defects.
- An audit finding should be re-verified against the real implementation's depth/intent (not just spec-literal comparison) before being fixed — the "non-invitee reminder opt-in" finding looked like a bug from the spec's wording alone but was clearly a deliberate feature once the route code was read.

## Problems solved

- None novel — this session's shape (spec describes something already shipped differently) is now a well-recognized recurring pattern in this repo, not a fresh problem each time.

## Current state

- Branch `shared-wishlist-view` (branched off `main` after PR #17 merged), changes not yet committed.
- Changed: `app/w/[id]/page.tsx`, `components/wishlist/{SharedWishlistClient,SharedWishlistHeader,SharedWishlistItem}.tsx`, `lib/wishlist/{display,shared,types}.ts`, `context/ROADMAP.md`, `context/design/COMPONENT_LIBRARY.md`, `context/feature-specs/08-SHARED-WISHLIST-VIEW.md`.
- New: `app/w/[id]/not-found.tsx`, `components/wishlist/SharedWishlistNotice.tsx`, `gifvtme_migration_013_shared_wishlist_access.sql`.
- `gifvtme_migration_013_shared_wishlist_access.sql` has **not** been applied to the Supabase project (no DB access from this environment) — same unconfirmed-application state as migrations 003/004/005/006/008/011/012, now unresolved across 5+ sessions.
- Not committed yet — developer hasn't asked to commit this pass.

## Next session starts with

Run `/remember restore`. Ask the developer:
1. Whether to commit this pass now.
2. Whether migration 013 (and the still-outstanding 003/004/005/006/008/011/012) have been applied to Supabase yet.
3. Whether to finally set up a definitive way to track migration-apply state (e.g. a `schema_migrations` marker table) instead of re-asking this every session — it's been open since session 1.

## Open questions

- The migration-apply tracking problem is still unresolved after 5+ sessions (003, 004, 005, 006, 008, 011, 012, now 013) — worth the developer resolving definitively rather than it staying a recurring open item.
- `09-ITEM-DETAIL-GIVER.md` and the purchase/confirm/success pages under `app/w/[id]/item`, `/confirm`, `/success` were explicitly out of scope this session and not audited — they may have similar spec-vs-shipped gaps given the pattern established across three specs so far.
