# Memory — Order Tracking (16) Built From Spec + Review-Finding Fixes

Last updated: 2026-08-07

## What was built

- Read and implemented `context/feature-specs/16-ORDER-TRACKING.md` from scratch on branch `order-tracking` — a genuine new build, not a gap-closing pass (only `/account/orders/[id]` existed before, as the post-checkout confirmation screen; see prior session's "Cart and Flutterwave checkout" entry). Did the full AGENTS.md-mandated context read first (PROJECT_OVERVIEW/PRD/BUSINESS_RULES/ROADMAP, then API_ROUTES/DATABASE_SCHEMA/FOLDER_STRUCTURE/CODING_STANDARDS) before writing any code.
- `gifvtme_migration_019_order_tracking.sql`: adds `tracking_number`/`tracking_url`/`carrier_name`/`estimated_delivery`/`status_change_notes` to `orders`; formally owns `order_status_history` (`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` for `customer_notified`/`notes`/`retry_count`/`permanently_failed`/`claimed_at`, same pattern as migrations 015/016); adds the `on_order_status_changed` and `validate_order_status_transition` triggers (backward/skip-step guard, implemented verbatim from the spec's own transition map); adds owner-scoped RLS on `order_status_history`; fixes `orders.wishlist_item_id`'s FK to `ON DELETE SET NULL` (spec Edge Case #6).
- `lib/orders/`: `types.ts`, `statusTransitions.ts` (+ unit tests — `isValidOrderStatusTransition` mirrors the DB trigger), `buildOrderStatusEmail.ts` (+ unit tests, per-status copy taken directly from spec), `server.ts` (`getOrdersForUser`/`getOrderDetail`).
- `lib/email/resend.ts`: added `sendOrderStatusEmail`.
- API: `GET /api/orders`, `GET /api/orders/[id]`, `POST /api/orders/notify` (cron, same atomic-claim/retry/`permanently_failed` pattern as `/api/reminders`/`/api/thank-you/process`).
- `vercel.json`: added `/api/orders/notify` on a **daily** cron (`30 6 * * *`) — Vercel Hobby plan only allows daily schedules, same constraint as reminders/thank-you.
- UI: `components/order/OrderStatusBadge.tsx`, `OrderCard.tsx`, `OrderList.tsx` (Active/Completed/Cancelled tabs), `OrderTracking.tsx` (4-step GSAP-pulsed tracker, red banner for cancelled/refunded), `TrackingLink.tsx`; `app/account/orders/page.tsx` (new list page); rebuilt `app/account/orders/[id]/page.tsx` around the full tracking view (tracker, summary, shipping, tracking section, expandable `<details>` history timeline).
- Deleted `components/order/OrderConfirmationScreen.tsx` (confirmed no other callers first) — the rebuilt detail page now covers that same "just confirmed" moment as one of its tracker states.
- Added `warning`/`info` variants to `components/ui/Badge.tsx` (amber/blue, for the order status badge).
- Updated context docs in the same change: `API_ROUTES.md`, `DATABASE_SCHEMA.md`, `ROADMAP.md`, `FOLDER_STRUCTURE.md`, `COMPONENT_LIBRARY.md`, `ui-registry.md`, `15-CART-CHECKOUT.md` (its `/account/orders/[id]` description), and `16-ORDER-TRACKING.md` itself (new "Implementation notes" section documenting every divergence instead of a full rewrite, since this was a from-spec build that matched closely).
- Three follow-up review-finding fixes, each individually re-verified against current code before fixing (per [[feedback-verify-and-fix-findings-workflow]]):
  1. `app/api/orders/notify/route.ts`: reduced `BATCH_LIMIT` from 50 to 10 — serial (not concurrent) processing with no `maxDuration` override risked exceeding Vercel Hobby's 10s default execution limit.
  2. `FOLDER_STRUCTURE.md`: added the missing `account/orders/` list route and `TrackingLink` to the `order/` component inventory (both existed in code but weren't documented).
  3. `ROADMAP.md`: removed a stale "Actual Resend email sending for order status — not started" bullet now that `/api/orders/notify` genuinely sends.
- Two commits landed this session: `59ccb27` ("feat: implement order tracking and fulfillment features") and `38fab4a` ("feat: enhance order tracking and email notifications with error handling and HTTPS validation"). **Neither commit nor the push/merge was done by me** — the developer committed, pushed, and merged (`origin/order-tracking` → PR #29 → `main`) between turns, applying some of my edits directly plus their own additions: `38fab4a` includes an `isHttpsUrl()` guard in `buildOrderStatusEmail.ts` (only trusts `https:` tracking URLs, falls back to the order link otherwise), `escapeHtml()` around the CTA URL itself in `ctaButton()`, `aria-pressed` on `OrderList.tsx`'s tab buttons, and a `pendingOrderError` check added to the fallback query in the order detail page — none of which I wrote.

## Decisions made

- Confirmed [[feedback-spec-vs-architecture-precedence]] applies even to an explicit "read and implement exactly as specified" instruction — full context-file audit came first regardless of the literal instruction's wording.
- The spec's transition-map SQL was implemented **verbatim** despite an internal inconsistency (Functional Requirement #3's prose allows cancellation "from any non-terminal status"; the literal map doesn't allow `cancelled` from `pending_payment`/`payment_failed`) — documented the inconsistency rather than silently resolving it by guessing intent.
- Added `retry_count`/`permanently_failed`/`claimed_at` to `order_status_history` beyond the spec's literal Database Changes SQL block — justified because the spec's own Edge Case #4 requires equivalent behavior, and every other cron in this repo (reminders, thank-you) already uses this exact concurrency pattern.
- `refunded` orders were placed in the Cancelled tab and `delivered`'s email CTA points at the order instead of a review page — both are judgment calls where the spec was silent or referenced an unbuilt feature (reviews), documented as explicit assumptions rather than left silent.

## Problems solved

- Vercel Hobby plan only allows daily cron schedules (see [[project-vercel-hobby-cron-limit]]) — `/api/orders/notify` scheduled daily instead of the spec's every-5-minutes, matching the existing reminders/thank-you precedent.
- A pasted review finding correctly identified that `/api/orders/notify`'s serial processing loop (`BATCH_LIMIT=50`, no `maxDuration` override, no concurrency unlike `/api/thank-you/process`) risked exceeding Vercel Hobby's 10s default execution window even in the typical case. Fixed by reducing `BATCH_LIMIT` to 10, reasoning documented inline — a row that doesn't finish in time is safely retried once its claim goes stale, so under-sizing the batch for the common case (rather than the worst case) is fine.

## Current state

- Branch `order-tracking` (tracks `origin/order-tracking`), working tree clean.
- **This work is already merged to `main`** — `origin/main` includes it via merge commit `2a81ee7` ("Merge pull request #29 from givftme/order-tracking"). The local branch has nothing further to push.
- `tsc`, `eslint`, `npm test` (127/127) all clean as of the last check on this branch.
- **`gifvtme_migration_019_order_tracking.sql` has not been confirmed applied to the live Supabase project** — no DB access from this environment to verify. Same "flag it, don't assume" pattern as every prior migration in this codebase (015–018 each needed an explicit later confirmation from the developer).

## Next session starts with

- Confirm whether migration 019 has been applied to Supabase.
- Switch back to `main` and pull, since `order-tracking`'s work is done and already merged.
- Remaining unaudited feature-specs: `17-REVIEWS.md`, `18-FLASH-SALES.md`, `19-ACCOUNT-MANAGEMENT.md`, `20-ADDRESS-BOOK.md` (15 and 16 are now both done — audit each before assuming unbuilt, per the established pattern).

## Open questions

- Whether `/api/reminders` and `/api/thank-you/process` (both serial loops, both `BATCH_LIMIT=50`, neither has a `maxDuration` override) should get the same Hobby-plan duration-risk fix just applied to `/api/orders/notify` — same likely root cause, not yet checked.
- Whether the "Gifvtme" vs "Givftme" naming inconsistency (open since prior sessions) has been addressed — not touched this session.
- Whether the two commits left unpushed at the end of the 2026-08-06 session (`0d0fb75`, `4aac74d`, on `main`) ever got pushed — not verified this session since all work happened on `order-tracking`, a different branch.
