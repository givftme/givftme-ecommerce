# Memory — Gift Museum & Catalog (13) Gap-Closing Pass

Last updated: 2026-08-02

## What was built

- Session opened with `/remember restore`. Restored memory described a `thank-you-messages` branch session, but the actual current branch was `givft-museum` — memory.md is a repo-wide file that survives across branches, so this was expected, not an error. Cross-checked: the ROADMAP/spec-12 changes the restored memory described as "uncommitted" had already been committed and merged (`7ea4916`, PR #24) since that memory was written; the only real leftover was `memory.md` itself, still staged from the prior session. Committed it (`c9c49e4`).
- Developer said "Read and implement exactly as specified" for `context/feature-specs/13-GIFT-MUSEUM-CATALOG.md`. Per [[feedback-spec-vs-architecture-precedence]] (10th+ confirmation), audited before writing anything — this time via an Explore-subagent audit rather than doing it inline, since the spec is large. Finding: unlike spec `12` (which was entirely unbuilt), the Gift Museum & Catalog feature was **already fully shipped** in an earlier session — `context/ROADMAP.md` already listed it under "Done" (occasions/collections/shop/product/search pages, Sanity schema with flash-sale fields, GROQ queries, pricing helpers, variant selector, wishlist picker all existed and matched spec intent, differing only in naming: `museum.*` analytics vs spec's `catalog.*`, `status` enum vs `archived` boolean).
- Also found an orphaned, unmerged branch `gift-museum/catalog` with one extra commit (`a687de9`, "Enhance wishlist item handling and error logging in API routes") not on `givft-museum`. Investigated and rejected — it's an *older* state of the code that predates this branch's server-side price/availability hardening on the wishlist-add API; cherry-picking it would have reintroduced a client-trusted-price regression (removes the server-side Sanity price re-fetch and `status === "active"` check, trusts client-supplied `price`/`title`). Left un-merged, intentionally.
- Audit surfaced 7 genuine gaps (real behavior issues, not cosmetic naming). Developer said "fix all". Built:
  1. **Money-related fix:** `lib/flutterwave/getActivePrice.ts` (checkout) and `lib/sanity/catalog.ts`'s `getProductDisplayPrice` (display) had no guard against a Sanity data-entry error where `salePrice` is entered higher than `basePrice`/variant price — added `Math.min()` clamping to both (spec Edge Case #6). Added an optional `now` param to `getActivePrice` (matching `isFlashSaleWindowActive`'s existing pattern) so sale-window tests could be deterministic.
  2. `app/search/page.tsx` fired a Sanity GROQ query for any non-empty input (including 1 character) with no sanitization of special characters — added `sanitizeSearchQuery`/`isSearchableQuery` helpers in `lib/sanity/catalog.ts` (strips `"`/`*`/`\`, requires ≥2 chars) and a "Type at least 2 characters to search" empty state.
  3. `components/shared/WishlistPickerSheet.tsx` had no "Create new occasion" link and no cap on long wishlist lists — added a link to `/my-occasions/new` and a scrollable 6-option cap (spec Edge Case #5).
  4. `components/product/ProductDetail.tsx`'s variant selector disabled Add to cart/wishlist with zero explanation when an attribute was unselected — added a "Please select a [attribute]" hint using `attribute.label`.
  5. `components/product/ProductCard.tsx`'s flash-sale badge had no countdown timer (only `ProductDetail` did) — wired the existing `FlashSaleTimer` component into the card badge.
  6. Added `museum.search.product_clicked` (query, product_id, position) analytics — threaded an `onProductClick`/`searchQuery` prop chain through `ProductCard` → `ProductGrid` → `CatalogProductGrid` → `ProductExplorer`; fires only when `ProductExplorer` receives a `searchQuery` prop (i.e. only from `/search`, not shop/collection grids), avoiding the server→client function-prop serialization problem since `searchQuery` is a plain string.
  7. New test files `lib/flutterwave/getActivePrice.test.ts` and `lib/sanity/catalog.test.ts` (23 new tests: sale-window logic, variant pricing, the new salePrice-clamp guard, search sanitization/length-gating). `npm test` went from 59/59 to 82/82, all clean. `tsc` and `eslint` also clean.
- Updated `context/ROADMAP.md` with a new bullet documenting this gap-closing pass and exactly what was fixed vs. left as shipped (naming/architecture divergences). Added a status note to the top of `13-GIFT-MUSEUM-CATALOG.md` pointing to ROADMAP — but, unlike spec `12`, did **not** rewrite the spec body, since most of it already matched shipped reality (only `12` needed a full rewrite because it was previously 100% unbuilt).
- Committed as two commits and pushed to `origin/givft-museum`: `7801324` (the actual gap-closing fixes) and `edfaca6` (a stray blank-line the IDE auto-inserted into `13-GIFT-MUSEUM-CATALOG.md` after it was opened in-editor mid-session — caught via `git diff` after the first commit).

## Decisions made

- Confirmed again that shipped/architecture-documented code wins over a literal "implement exactly as specified" instruction — [[feedback-spec-vs-architecture-precedence]] continues to hold, now across specs 09–13. This session's variant of the pattern was closer to the `08`/`09`/`10`/`11` "gap-closing pass" shape (audit → fix real gaps → leave cosmetic divergence) than `12`'s "nothing to do, just confirm and mark Done" shape.
- Spec files only get a full rewrite when the shipped feature bears little resemblance to the spec's literal text (as `12` was, being entirely unbuilt beforehand). When most of the spec already matches, a short status note pointing to ROADMAP is enough — added for `13` accordingly.
- Orphaned branch commits are evaluated on their actual diff before considering cherry-picking, not assumed newer-is-better — `a687de9` looked plausible by name but was actually a regression.
- Added an optional `now` parameter to `getActivePrice` purely for test determinism — small, backward-compatible (defaults to `new Date()`), not scope creep.

## Problems solved

- The restored memory's branch name (`thank-you-messages`) didn't match the actual current branch (`givft-museum`) — resolved by treating memory.md as a repo-wide (not branch-scoped) record and re-verifying actual git state (`git log`, `git status`) rather than trusting the stale branch reference, per the memory system's own "verify before recommending" rule. This is the second session in a row this exact verification step mattered.
- IDE auto-formatting inserted a stray blank line into `13-GIFT-MUSEUM-CATALOG.md` (outside any line I'd edited) after the file was opened in-editor — caught by reviewing `git status`/`git diff` after the first commit rather than assuming the working tree was clean, and fixed in a small separate commit rather than folded into the feature commit.

## Current state

- Branch `givft-museum` merged to `main` via PR #25 (`2ae98ec`) and the repo is back on `main`, clean. Three commits landed this session before the merge: `c9c49e4` (memory.md carryover from the restored thank-you-messages session), `7801324` (catalog gap-closing fixes), `edfaca6` (blank-line fix). This memory.md update itself was written but not committed during the session — committed in a follow-up step after being flagged on restore.
- `tsc`, `eslint`, `npm test` (82/82, up from 59) all clean as of the last check.
- `context/ROADMAP.md`: Gift Museum & Catalog (spec 13) now has a full gap-closing-pass bullet under "Done" (it was already listed as Done before this session, from an earlier one — this pass just closed the real gaps against the spec).
- `context/feature-specs/13-GIFT-MUSEUM-CATALOG.md`: status note added at top, spec body otherwise unchanged (deliberately not rewritten — see Decisions).

## Next session starts with

Run `/remember restore`. Nothing is pending — everything from this session is committed and pushed. Ask the developer what's next. Note for whoever picks this up: `context/feature-specs/` actually goes up to `20-ADDRESS-BOOK.md`, not just through `13` as a prior session's memory assumed — remaining specs are `14-SEARCH.md`, `15-CART-CHECKOUT.md`, `16-ORDER-TRACKING.md`, `17-REVIEWS.md`, `18-FLASH-SALES.md`, `19-ACCOUNT-MANAGEMENT.md`, `20-ADDRESS-BOOK.md`. Worth flagging: `14-SEARCH.md` likely overlaps significantly with the search sanitization/minimum-length work just done as part of `13` — check `14` against current `app/search/page.tsx` state before assuming it's a fresh build; some or all of its requirements may already be satisfied.

## Open questions

- What's applying build-breaking mid-session edits noticed several sessions ago (during the Reminders session) — still unresolved, still not investigated, keeps getting deferred. Worth the developer actually looking into this at some point rather than it persisting as a recurring open item.
- Whether the developer wants the "Gifvtme" vs "Givftme" codebase-wide naming inconsistency looked at more broadly, or considers it fully settled (unresolved from prior sessions).
- Whether `14-SEARCH.md` has requirements beyond what `13`'s gap-closing pass already covered (debounce input, live-search-as-you-type specifically — `13`'s audit noted the current search is a plain submit-on-enter GET form, not a debounced live search, and that divergence was left alone as architectural, not a bug — but `14` may specify it as a hard requirement rather than a nice-to-have).
