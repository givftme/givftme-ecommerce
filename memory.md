# Memory — Item-Scraping Spec Audit + Analytics/UX Gap Fixes

Last updated: 2026-07-30

## What was built

- Audited `context/feature-specs/05-ITEM-SCRAPING.md` against the already-shipped, architecture-documented implementation (`app/api/scrape/route.ts`, `lib/scraper/microlink.ts`, `lib/affiliate/transform.ts`, `lib/wishlist/images.ts`, `lib/wishlist/validation.ts`, `components/wishlist/AddItemSheet.tsx`). This feature was already fully built (ROADMAP.md lines 25-27, 41), not a gap to implement from scratch.
- Closed 6 confirmed genuine gaps, all in `components/wishlist/AddItemSheet.tsx`:
  1. `wishlist.item.scrape_attempted` analytics event now fires when Fetch is clicked (previously only succeeded/failed were tracked).
  2. `wishlist.item.scrape_failed` now carries a `reason` field (the error message), not just `domain`.
  3. `wishlist.item.image_uploaded` fires on manual file upload (`source: "upload"`).
  4. `wishlist.item.image_skipped` fires on save with no image — added to **both** the server-backed save path and the `draftMode || !wishlistId` local-save path (the second one was missed in the first pass, caught and fixed in a follow-up review round).
  5. A "⚠ Scraped price may be in a foreign currency — verify before saving" warning renders next to the price field when `scraped_currency !== "NGN"` (uses the existing `amber` warning-color convention from `IntentFlagBadge`, per `context/design/COMPONENT_LIBRARY.md`).
  6. Enter key no longer submits the multi-field form from any text input (form-level `onKeyDown` guard; Textarea newlines and Save/tab buttons still work).
- `tsc --noEmit` and `eslint` pass clean on `AddItemSheet.tsx` after every round.

## Decisions made

- Per user's explicit choice, several spec-vs-shipped divergences were deliberately **left alone** (not "fixed" toward the spec's literal wording), matching [[feedback-spec-vs-architecture-precedence]]:
  - Storage bucket is `wishlist-images`, **private** with signed URLs — spec wants a public `item-images` bucket. Already documented in `DATABASE_SCHEMA.md`; making it public would be a privacy regression.
  - Amazon URLs are hard-blocked before calling Microlink at all (spec says "try then fall back"). Not documented anywhere, but treated as an intentional perf/UX shortcut, not a bug.
  - Price is `number | null` + separate `currency` field, not the spec's `{amount, currency}` object; validation schemas are `externalWishlistItemSchema`/`catalogWishlistItemSchema`/`editWishlistItemSchema` (discriminated union), not the spec's `scrapeRequestSchema`/`manualItemSchema` shape.
  - Analytics events use `wishlist.item.*` naming (matches this app's convention elsewhere), not the spec's bare `scrape.*`/`item.image.*` names.
  - The spec's "consider a soft duplicate-URL warning" suggestion is already built (a confirmation dialog: "This might already be on your list… Add it anyway?").
- Scope of the fix session was explicitly narrowed by the user to "only close genuine gaps" — no test harness was added even though the spec calls for unit/integration tests, because the repo currently has **zero test files anywhere**, and adding a whole test harness felt like a separate decision, not a drive-by fix.

## Problems solved

- First pass of the `image_skipped` event only covered the server-backed save branch of `saveItem`; a code-review-style re-check of the finding against current code caught that the `draftMode || !wishlistId` branch (used for occasion-draft/local adds) never fired *any* analytics event, so the gap was still open there. Fixed by adding the same conditional `trackEvent("wishlist.item.image_skipped")` call right after `onItemAdded(...)` in that branch, without touching duplicate-resolution ordering or the regular path's existing telemetry.

## Current state

- Branch `item-scraping` (switched from `main` at some point outside this conversation's visible actions — not something this session did deliberately, just noting it).
- `components/wishlist/AddItemSheet.tsx` has uncommitted changes (all 6 gap fixes). Not yet committed.
- `context/feature-specs/05-ITEM-SCRAPING.md` itself was not modified — it's a spec doc, treated as input, not output.

## Next session starts with

Run `/remember restore`, then ask the user whether to commit `components/wishlist/AddItemSheet.tsx` (currently uncommitted on branch `item-scraping`). No other pending work threads from this session.

## Open questions

- Should a test harness be introduced at all, given the repo has no tests anywhere? This came up as a real spec requirement (unit tests for `parsePrice`, `buildAffiliateUrl`, zod schemas; integration tests for `/api/scrape`) but was explicitly deferred, not rejected.
- Should the deliberate deviations from `05-ITEM-SCRAPING.md` (especially the Amazon pre-block, which isn't written down anywhere) be documented in `context/architecture/ARCHITECTURE.md` or a decision log, so a future session doesn't re-flag them as unexplained conflicts? `DATABASE_SCHEMA.md` already covers the bucket-privacy decision; the Amazon-block reasoning currently only lives in this memory and conversation history.
