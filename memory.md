# Memory — Catalog-Item Wishlist: Gap-Closing + Review Fixes

Last updated: 2026-07-30

## What was built

- `context/feature-specs/06-CATALOG-ITEM-WISHLIST.md` described catalog-item-to-wishlist as if unbuilt, but it was already shipped and marked Done in `context/ROADMAP.md`. Per [[feedback-spec-vs-architecture-precedence]], checked the spec against shipped code first instead of implementing it literally — found real conflicts (query name, error codes, `master_items` scope, picker UX). Developer chose "keep shipped behavior, close only real gaps" over a literal spec rewrite.
- Closed the two real gaps:
  - **409 duplicate-prevention** in the catalog branch of `POST /api/wishlists/[id]/items` (`app/api/wishlists/[id]/items/route.ts`). Hardened after an initial app-level-only check was flagged as racy: added `gifvtme_migration_011_catalog_wishlist_dedupe.sql` (partial unique index `wishlist_items_live_catalog_unique` on `(wishlist_id, catalog_product_id)` for non-archived catalog rows) plus a `23505` catch on insert, so concurrent requests can't both slip past the pre-check.
  - **Filled-heart wishlisted state**: new `GET /api/wishlists/catalog-items` route + `getWishlistedCatalogProductIds()` in `lib/wishlist/server.ts`, wired into `components/product/CatalogProductGrid.tsx` (fetches on mount, updates locally via a new `onAdded` callback on `WishlistPickerSheet`).
- Rewrote `06-CATALOG-ITEM-WISHLIST.md` section-by-section to document shipped reality instead of the original aspirational spec (query name, status codes, `master_items` evergreen-only scoping, Sheet-only/auto-select picker UX, no hover tooltip, filled-heart doesn't navigate/remove, product-detail button label never changes).
- Updated `context/architecture/API_ROUTES.md` to match (new endpoint, corrected pricing description — `getFromPrice()` not a flat `getActivePrice()`).
- Went through several rounds of code-review findings (one at a time) and fixed the still-valid ones:
  - `createClient()`/`getAuthenticatedApiUser()` moved inside the `try` block in the new catalog-items route, so env/auth failures return the documented `{ error }` shape instead of an unhandled exception.
  - `Cache-Control: private, no-store` on all catalog-items route responses + `cache: "no-store"` on the client fetch — it's personalized per-user data on a fixed URL.
  - Excluded archived `wishlist_items` rows from `getWishlistedCatalogProductIds()` (a removed item was still showing a filled heart).
  - One finding (archived-row exclusion on the duplicate-lookup query) was already fixed in an earlier round — verified and skipped as a duplicate, not re-applied.
- `lib/api/response.ts`: `jsonError()` gained an optional third `headers` param (backward compatible, all other call sites unaffected).
- Full 7-file gap-closing commit landed as `9b9770b`; the subsequent review-fix round landed as `595982e` ("Implement coderabbit suggestions") — the developer committed that one directly, not me.

## Decisions made

- Shipped/architecture-documented code wins over a feature-spec's literal wording by default — ask before rewriting toward the spec. Confirms [[feedback-spec-vs-architecture-precedence]] as a durable pattern in this repo, not a one-off.
- Duplicate prevention needs both an app-level pre-check (fast path, good error message) *and* a DB-level unique index + `23505` catch (actual correctness guarantee) — check-then-insert alone is a race.
- Personalized GET endpoints need explicit `Cache-Control: private, no-store` even though Next 16 route handlers aren't cached by default at the framework level — that doesn't stop a CDN or the browser's HTTP cache from caching the response headers-permitting.

## Problems solved

- Each code-review finding was re-verified against current code before fixing (per this session's working pattern) — one finding turned out to already be fixed by an earlier round and was correctly reported as `no_change_needed` rather than reapplied.

## Current state

- Branch `catalog-item-wishlist`, working tree clean, two commits ahead covering this work: `9b9770b` then `595982e`.
- `tsc --noEmit`, `eslint`, and `npm test` (27/27) all clean after every round.
- `gifvtme_migration_011_catalog_wishlist_dedupe.sql` exists in the repo but has **not** been applied to the Supabase project yet (no DB access from this environment) — the 409 pre-check works today, but the atomic DB-level guarantee isn't live until that migration runs, consistent with how migration 003's "must still be applied" note is tracked in `ROADMAP.md`.
- Branch has not been pushed to `origin`, and no PR has been opened.

## Next session starts with

Run `/remember restore`. No pending uncommitted work. Ask the developer:
1. Whether `gifvtme_migration_011_catalog_wishlist_dedupe.sql` has been applied to Supabase yet.
2. Whether to push `catalog-item-wishlist` and open a PR.

## Open questions

- None blocking — the two real gaps identified this session are closed and reviewed. The migration-apply step above is the only loose end.
