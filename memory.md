# Memory — Evergreen Wishlist Gap-Closing + Review Fixes

Last updated: 2026-07-28

## What was built

- Audited `context/feature-specs/03-EVERGREEN-WISHLIST.md` against the already-shipped, architecture-documented evergreen wishlist implementation (per `context/ROADMAP.md`'s "Evergreen wishlist core — Done"). Found several deliberate, documented deviations (route is `/wishlists` not `/dashboard/wishlists`; reorder uses up/down buttons not dnd-kit; delete is a soft-archive not a hard delete with occasion warning; reorder payload is `{ordered_ids}` not `{items:[{id,sort_order}]}`) — left those alone per user decision.
- Closed 4 confirmed gaps, committed as `db5f634` on branch `evergreen-wishlist`:
  1. `PATCH /api/wishlists/[id]/items/[itemId]` now syncs the paired evergreen `master_items` row (title/image/price) — added `syncMasterItemFromWishlistItem()` in `lib/wishlist/server.ts`, matched by `user_id`+`origin`+`catalog_product_id`/`product_url`+closest `created_at` (no FK exists between an evergreen `wishlist_items` row and its own `master_items` row — `master_item_id` is reserved for occasion-pull links, migration 005).
  2. `POST /api/wishlists/[id]/items` catalog-origin adds now re-fetch title/image/price from Sanity server-side (`CART_PRICES_QUERY`) instead of trusting the client payload; added `getFromPrice()` helper for variant products.
  3. Wired the previously built-but-unused `/api/scrape` (Microlink) into `components/wishlist/AddItemSheet.tsx`: real "Add from URL"/"Add manually" tabs, Fetch button, editable preview on success, auto-fallback to manual on failure/timeout (5s "taking a while" + skip), `AbortController`-based cancellation.
  4. Corrected stale `/wishlists/new` and `/wishlists/[id]/edit` entries in `FOLDER_STRUCTURE.md` — evergreen is auto-created/one-per-user, occasion creation already lives at `/my-occasions/*`. Updated `API_ROUTES.md`/`ROADMAP.md` to match.
- Applied 4 rounds of code-review-style fixes after that commit (uncommitted as of this save):
  1. Edit-item `master_items` sync failure was returning a 500 even though the primary `wishlist_items` update had already succeeded, contradicting the documented "best-effort" sync contract — now logs and still returns `{ item }`.
  2. Catalog-item title had a `product.title || data.title` fallback that let client-supplied title persist despite docs saying client fields are "ignored" — removed the fallback in both the `wishlist_items` insert and the `master_items` mirror.
  3. `AddItemSheet`'s scrape-failure message (`scrapeError`) was only rendered in the URL-tab block, but `skipToManual("scrape_failed")` switches to the manual tab immediately, so the explanation was invisible — added rendering in the manual-tab block too.
  4. `syncMasterItemFromWishlistItem`'s lookup query didn't exclude purchased/archived `master_items` rows, risking a match against a stale row instead of the active one — added `.neq("status","purchased").neq("status","archived")`, matching the existing convention in `lib/occasion/server.ts`.

## Decisions made

- Spec-vs-shipped-architecture conflicts on this feature: treat the shipped/documented behavior as settled, don't rewrite toward the spec's literal wording (route naming, no dnd-kit, soft-delete, reorder payload shape).
- Evergreen `wishlist_items` ↔ `master_items` correlation on edit is done via `user_id`+`origin`+identifier+closest-`created_at` matching, not a new FK column — user explicitly chose "no schema change" over adding a link column.
- Variant catalog products get a wishlist "from" price = cheapest available variant's price (or the flat `salePrice` during an active flash sale), rather than rejecting quick-add of variant products outright.

## Problems solved

- **Recurring, unexplained external file corruption this session** (same pattern as the prior profile-management session's file resets, see the old memory this replaces): after I fixed and validated files, they were later found reverted/mangled — `app/api/wishlists/[id]/items/route.ts` reverted to a broken mix of old+new code (undefined `data`/`imageUrl`), `AddItemSheet.tsx`'s `resetSheet` had a previously-removed ref mutation reintroduced (twice), and `lib/wishlist/server.ts` once contained literal `+` diff markers and a syntactically broken statement pasted into the middle of a function. Root cause never identified. **Always re-`Read` and re-`tsc`/`eslint` a file immediately before trusting it, even one you fixed earlier in the same session** — do not assume a prior fix is still present.
- Root-caused a real `eslint-plugin-react-hooks` "react-hooks/refs" (React Compiler-linked) rule quirk: it flags `form.handleSubmit(inlineCallback)` in JSX as "Cannot access refs during render" whenever *any* function transitively reachable from that callback mutates a ref — even though `handleSubmit` only wraps the callback and never invokes it during render. Concretely: `saveItem` → `closeSheet` → `resetSheet` mutating `scrapeAbortRef.current` was enough to flag the unrelated `onSubmit={form.handleSubmit(...)}` line. Fix: never mutate a ref from anything reachable from the form's submit-callback chain; keep ref mutations scoped to handlers outside that chain (here: `handleFetch`/`skipToManual`/`switchToManualTab` only).
- `product.basePrice` is hidden/never set in Sanity Studio whenever `hasVariants: true` (`sanity/schemaTypes/product.ts:154`). Any code computing price via `... ?? product.basePrice ?? 0` for a variant product with no `combinationKey` silently produces `price: 0`. `getActivePrice(product, null)` has this exact trap — checkout avoids it via an earlier explicit variant-availability guard (`getUnavailableItem`), but nothing else does automatically. Every variant `productVariant.price` is Sanity-required/non-null, so "cheapest available variant" is always a reliable fallback.

## Current state

- Branch `evergreen-wishlist`, base commit `db5f634` (the 4 gap-closing fixes), plus 4 further rounds of review fixes **not yet committed**.
- `tsc --noEmit` and `eslint` pass clean on all touched files as of the last check: `lib/wishlist/server.ts`, `app/api/wishlists/[id]/items/route.ts`, `app/api/wishlists/[id]/items/[itemId]/route.ts`, `components/wishlist/AddItemSheet.tsx`, plus the three doc files.
- This memory.md replaces a stale one from an already-closed-out profile-management session (branch `profile-management`, merged via PR #12) — that work is done, not part of this thread.

## Next session starts with

Run `/remember restore`, then — given the repeated external corruption pattern — re-verify each fix is actually intact before trusting it: grep `lib/wishlist/server.ts` for `.neq("status", "purchased")` inside `syncMasterItemFromWishlistItem`, grep `app/api/wishlists/[id]/items/route.ts` for `title: product.title,` (no `|| data.title`), grep `components/wishlist/AddItemSheet.tsx` for `activeTab === "manual" && scrapeError` and confirm `resetSheet` does NOT touch `scrapeAbortRef`. Then ask the user whether to commit the 4 uncommitted review-fix rounds on top of `db5f634`.

## Open questions

- Should the 4 uncommitted post-`db5f634` fixes be committed as their own commit, or amended in?
- What is actually causing the recurring external file corruption (diff markers, silently reverted fixes) — this is now the second session in this repo to hit it. Worth a dedicated investigation (IDE extensions, auto-format-on-save, a stray git hook, or another concurrent agent/process touching the same working tree) if it keeps happening.
