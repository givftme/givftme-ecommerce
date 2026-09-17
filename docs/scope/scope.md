# Scope: Givtme occasion gifting

You already have an occasion gifting application with a store. This scope reuses that foundation to complete the specified platform, including real gift pooling behind its implementation gates.

**Build approach:** Tracer Bullet (recommended, finish one real path through the existing application at a time).
**Workflow:** Beta (recommended, verify behavior and run relevant tests after development). Sharing, guest checkout, and pooling use GA because they affect privacy or money, adding independent review and change documentation.
**Planning basis:** Reconciled on 2026-09-17 against root `AGENTS.md`, [product precedence and priorities](../product/README.md), [Experience Design](../product/02-experience-design.md), [User Journey & Build Specification](../product/03-user-journey-and-build-specification.md), [Business Case & Financial Model](../product/01-business-case-and-financial-model.md), and [The Story](../product/04-the-story.md). Experience Design takes precedence over the build specification, followed by the business case and brand narrative. Product requirements remain in those documents. Earlier repository findings are retained; statements in the product documents that a capability is absent do not erase working code.

**Sequence:** Feature numbers remain stable. Table and section order follow the product's twelve week sequence, not a fresh twelve weeks of rebuilding. Gates can change delivery dates without removing a capability from the plan. No feature implementation is authorized by this scope update.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Accounts and existing commerce | Reuse | existing |
| 2 | Wishlist and occasion creation | Reuse | existing |
| 7 | Platform model and light setup | Weeks 1 to 2 | in-progress |
| 8 | Referral and outcome measurement | Weeks 1 to 2, then each slice | in-progress |
| 4 | Reliable occasion reminders | Weeks 3 to 4 | in-progress |
| 3 | Public shareable wishlists | Weeks 5 to 6 | in-progress |
| 5 | External product link unfurling | Weeks 7 to 8 | in-progress |
| 9 | Guest gifting and delivery promises | Weeks 7 to 8 | in-progress |
| 6 | Gift pooling | Weeks 9 to 10, gated | planned |
| 10 | Fulfilment and reveal | Week 11 | in-progress |
| 11 | Launch hardening | Week 12 | planned |

`existing` means implementation is present and retained, not that this pass certified its deployment. There are 2 existing, 7 in-progress, and 2 planned features. Nothing is marked done or dropped. Pooling has presentation controls but no functional flow found. Migration changes incompatible behavior, completion fills a partial journey, hardening improves reliability or privacy, and new implementation supplies missing capability. A feature can contain more than one kind of work.

## Reuse

### 1. Accounts and existing commerce · existing

Retain sign in, profiles, catalog browsing, variants, cart, checkout, payment verification, orders, external affiliate purchase marking, and gift acknowledgments. Existing authorization, validation, email helpers, UI primitives, and analytics provide dependencies for this slice.

External gifts follow affiliate redirects and purchase marking. Catalog gifts follow checkout and verified payment. Keep `wishlist_items.origin` authoritative. An external product URL or a purchase intent flag is not a payable catalog item or a pooled contribution.

Code: `app/(auth)/`, `app/account/`, `app/shop/`, `components/cart/`, `app/api/checkout/`, `app/api/flutterwave/webhook/`, `app/api/purchases/route.ts`, `lib/email/resend.ts`, `lib/analytics.ts`.

### 2. Wishlist and occasion creation · existing

Retain evergreen wishlists, item editing and ordering, master items, occasion creation, pulling saved items into an occasion, and catalog item addition. You also have important date forms and APIs, linked wishlists, recurring date fields, archive handling, and reactivation prompts. The scheduled lifecycle gaps belong to feature 4.

Code: `app/(dashboard)/wishlists/`, `app/(dashboard)/my-occasions/`, `app/(dashboard)/dates/`, `components/occasion/`, `lib/occasion/server.ts`, `lib/important-dates/server.ts`, `lib/wishlist/server.ts`.

## Weeks 1 to 2: Extend the foundation

### 7. Platform model and light setup · in-progress · needs a decision

**Work:** Migration and completion of existing accounts, dates, wishlists, and catalog discovery, with new contact capabilities. Email authentication and Google entry already exist; the OTP action verifies email rather than phone. Important dates store a person's name without the specified separate Contact model, and the occasion enum remains limited to six generic choices. Preserve existing records and access while adding the required relationships and phone OTP.

**Done when:** people see useful gift suggestions before an auth wall; saving a name, relationship, and date immediately shows three ideas without requiring full profile setup; contacts remain distinct from users, with explicit import consent, limited storage, retention, and deletion; existing accounts and dates migrate safely; timezone, milestone and notification preferences support feature 4; culturally specific occasions follow Experience Design, including separate wedding stages, Omugwo, Sallah, Japa, and condolence; Gift Museum discovery builds on the catalog with relationship and feeling based curation, wishlist priority, and truthful demand evidence; condolence surfaces use quiet copy and visuals without mascot, confetti, badges, or streak pressure.

1. [ ] Design it (spec): `/architect platform model and light setup`

Spec: [Platform model and light setup](../specs/0001-platform-model-light-setup/index.md).

Code: `app/account/`, `components/account/`, `app/(auth)/`, `components/auth/GoogleOAuthButton.tsx`, `lib/important-dates/types.ts`, `lib/occasion/constants.ts`, `components/reminders/ImportantDateForm.tsx`, `app/shop/`, `components/occasion/MuseumOccasionGrid.tsx`.

The product model is a migration target, not an instruction to replace all tables or rename all routes. Keep `wishlist_items.origin` as the transaction discriminator even if adding source metadata for manual items. Contact linking must respect wishlist visibility; the build document's automatic discovery wording does not authorize exposing private lists. Exact linking and aggregated demand privacy need design. Brand copy should follow The Story without pressure or guilt. The cold landing journey specifies six initial ideas; the three idea rule applies after the first date is saved.

### 8. Referral and outcome measurement · in-progress

**Work:** Complete existing analytics hooks with durable referral records and a weekly outcome view. `lib/analytics.ts` currently sends browser events to an API and logs server events. That transport is reusable but does not establish the specified `ReferralEvent` records or reporting.

**Done when:** every referral touchpoint records source, referrer, visitor, and action with appropriate privacy; the weekly view covers wishlist creation, shares, views, actions and signups, pool creation and contributor acquisition, reminders sent/opened/clicked/converted by channel, dates per user, repeat orders by cohort, and delivery window hit rate; later slices add their events as they ship. The product's roughly 40 percent organic acquisition assumption and below 20 percent month four warning are measurable, not claimed results.

1. [ ] Design it (spec): `/architect referral and outcome measurement`

Code: `lib/analytics.ts`, `app/api/analytics/route.ts`, `components/shared/TrackView.tsx`.

## Weeks 3 to 4: Bring people back before the occasion

### 4. Reliable occasion reminders · in-progress · needs a decision

Activate and finish the existing reminder engine. It already schedules email 14 and 3 days before important dates and occasions, supports invitee opt in, constructs emails, dispatches due rows, claims work, records failures, retries, and advances recurring dates. Effort is medium to large because failure recovery crosses several state changes.

**Work:** Migrate the 14 and 3 day schedule to T-30 for milestones only, T-7 with three suggestions and the recipient's wishlist first, and T-1 with available same day options. Complete user timezone, quiet hours, persistent preferences, and action deep links. Add WhatsApp and push delivery while reusing email. Experience Design settles the strict cap of three messages per occasion and user choice among WhatsApp, push, and email. The build document's T+1 recovery row cannot become a fourth message, and its channel priority table cannot override consent. Any optional recovery substitution or fallback channel policy still needs design within those constraints.

The remaining work includes reconciling the scheduler's request method with the POST only worker, supplying migration coverage for the worker's `advance_expected_date` field, and verifying deployed schema and delivery configuration. The configured worker handles at most 50 reminders per invocation. Scheduling failures can be logged after a successful date save, and recurrence advancement can succeed while scheduling the next occurrence fails. Owner unsubscribe deletes pending rows without persisting a future preference. These paths need a durable recovery and consent contract. Archive processing exists but is absent from `vercel.json`.

**Done when:** saved dates produce the specified ladder within the three message cap, user timezone, quiet hours, and chosen channels; opted in invitees receive accessible action links; T-7 email and push work in the early slice and approved WhatsApp templates are live before launch; the deployed schedule reaches the authenticated worker; missed scheduling, failed sends, overlapping runs, and failed state updates recover without lost or duplicate notifications; edits, deletion, unsubscribe, recurrence, leap dates, and archive behavior follow the designed lifecycle; backlog and delivery failures are visible to operators.

1. [ ] Design it (spec): `/architect reliable occasion reminders`

Code: `app/api/reminders/route.ts`, `app/api/reminders/unsubscribe/route.ts`, `lib/reminders/`, `lib/important-dates/server.ts`, `lib/occasion/server.ts`, `app/api/occasions/archive/route.ts`, `gifvtme_migration_015_reminders.sql`, `vercel.json`.

Dependency: reuse feature 2 and feature 7's timezone, contact, and preference model. Complete feature 3's access contract before releasing invitee delivery. Owner reminder repairs can proceed independently of sharing. Missed windows, recurring rollover timing, leap dates, consent retention, and expected volume still need design. Push has no delivery implementation but is in the initial plan. Begin WhatsApp business and template approval work in weeks 1 to 2; approval is an external launch dependency, not evidence that delivery already exists.

## Weeks 5 to 6: Share an occasion safely

### 3. Public shareable wishlists · in-progress · needs a decision · GA

Finish the existing owner to giver journey. Public links, invite tokens, visibility settings, price visibility controls, copied links, WhatsApp sharing, item detail pages, purchase intent, and purchase confirmation already exist. Effort is medium, concentrated on privacy and integration verification.

**Work:** Migration, completion, and privacy hardening. Migration 013 returns raw item prices from the shared database function even when `prices_visible` is false; application normalization hides them later. It also returns giver identity fields. Friends and family tokens currently act as bearer links, and accepting an unassigned invite can associate it with the signed in visitor. The target modes are settled: public, link only, and private. Map existing `friends_family` access and links without silently broadening access; legacy invite identity and revocation behavior still need a migration decision.

Complete the personal cover, message, priority and quantity model, generated share cards, and claims with guest identity and 72 hour reservation release. Preserve the surprise by hiding claims and giver identities from the owner by default. Public pages need server rendering and link previews, an occasion countdown, visible availability for visitors, and a route into guest gifting. Guest payment completion belongs to feature 9; monetary contributions belong to gated feature 6.

**Done when:** anonymous public and link only viewing works under the specified visibility contract; private and revoked access is denied through pages and direct data calls; hidden prices, claims, addresses, and unnecessary personal fields are withheld at the appropriate data boundary; reservations release after 72 hours without duplicate claims; share cards suit WhatsApp status and Instagram stories, with X and copied links supported; previews reveal no private data; the public page loads under 3 seconds on throttled 3G on a midrange Android device with minimal JavaScript dependence; guest actions, a create your own wishlist prompt, mobile use, and keyboard use work.

1. [ ] Design it (spec): `/architect public shareable wishlists`

Code: `app/w/[id]/`, `lib/wishlist/shared.ts`, `components/wishlist/ShareSettingsSheet.tsx`, `app/api/wishlists/[id]/invites/`, `gifvtme_migration_006_sharing_giver_flow.sql`, `gifvtme_migration_013_shared_wishlist_access.sql`, `gifvtme_migration_014_intent_flag_fixes.sql`.

## Weeks 7 to 8: Save gifts and complete guest gifting

### 5. External product link unfurling · in-progress · needs a decision

Finish the existing URL to editable preview to saved external item path. The form, authenticated scrape endpoint, metadata adapter, timeout, image fallback, manual entry, duplicate prompt, affiliate transformation, and analytics events already exist. Effort is medium; merchant coverage and failure handling need evidence.

**Work:** Complete and harden the adapter toward the specified short timeout metadata cascade (Open Graph, Twitter Card, JSON-LD, then oEmbed), a 24 hour URL hash cache, queued requests, rate limits, rotating user agents, and robots.txt handling. Keep the card editable and optimistic. Manual entry with domain, title, price, and photo upload is a normal supported path, including blocked shops and Instagram vendors. Reuse existing pieces that satisfy this contract.

The remaining work is to validate the actual metadata request and response contract against representative supported shops, then repair observed gaps. Current tests mock the scrape service or test price parsing; they do not prove live title, image, or price extraction. The request sets `meta=false` while the parser expects metadata, which needs investigation. URL checks accept a general URL without an explicit web scheme or destination policy. Foreign currency is warned about in the form, but its numeric price is saved without currency context, so it can be displayed as Naira.

**Done when:** supported links produce editable, credible previews and persist correctly; the cascade, cache, and queued rate limits work; missing data, blocked merchants, slow responses, redirects, and invalid destinations fall promptly into manual entry without a visible error state or blocking the UI; imported prices cannot be silently relabeled as Naira; external items remain outside catalog checkout; the URL form works on mobile and by keyboard; existing success and fallback events measure the path without retaining sensitive URL data unnecessarily.

1. [ ] Design it (spec): `/architect external product link unfurling`

Code: `components/wishlist/AddItemSheet.tsx`, `app/api/scrape/route.ts`, `lib/scraper/microlink.ts`, `lib/wishlist/validation.ts`, `app/api/wishlists/[id]/items/route.ts`, `lib/affiliate/transform.ts`.

Dependency: reuse feature 2 and verify saved items through feature 3. The product names Jumia and Konga as likely readable, and Amazon, Temu, Shein, and Instagram as likely fallback cases; successful scraping of every merchant is not a launch promise. Confirm treatment of unknown or foreign prices before implementation. Preserve source currency context without introducing currency conversion or changing Naira display rules.

### 9. Guest gifting and delivery promises · in-progress · needs a decision · GA

**Work:** Migrate authenticated checkout into a complete guest path while retaining catalog pricing, variants, payment verification, retry handling, and order machinery. Both `app/checkout/page.tsx` and the checkout API currently require a user. The shipping form has delivery instructions but no promised window or gift message contract.

**Done when:** a visitor buys a catalog gift from a shared wishlist through confirmation and subsequent order access without creating an account; external gifts retain affiliate redirects and purchase marking; guest claims and retries remain secure and idempotent; recipient details, a real delivery window, gift note, wrapping choice, and surprise handling survive through fulfilment; address visibility is restricted to its permitted purchase purpose; signup is a soft offer after gift selection or purchase, never a payment toll; prices remain server authoritative and formatted in Naira.

1. [ ] Design it (spec): `/architect guest gifting and delivery promises`

Code: `app/checkout/page.tsx`, `app/api/checkout/route.ts`, `app/api/checkout/route.test.ts`, `app/api/flutterwave/webhook/route.ts`, `components/checkout/CheckoutForm.tsx`, `lib/checkout/validation.ts`, `lib/orders/`.

Dependency: features 3 and 7 provide the guest access and claim model; agree the operational window and recipient data contracts with feature 10 during design. Guest order access must not weaken owner authorization. Service prices and the existing five minute sale grace period remain decision gates for affected pricing changes.

## Weeks 9 to 10: Gift pooling, implementation gated

### 6. Gift pooling · planned · needs a decision · GA

**Work:** New implementation of real monetary pooling, as settled by the product documents. `AddItemSheet` has a local group payment toggle that is not submitted or persisted. `ProductDetail` has a checked, read only group payment checkbox. No pool records, contribution accounting, contributor checkout, settlement, or refund flow was found. The evergreen item pool is a reusable item collection, not money pooling. Effort is large; payment architecture and unresolved settlement rules govern the estimate.

This is part of the initial product plan, not an optional pledge experiment. The gate is a reviewed payment and escrow architecture, legal review before any money moves, and resolution of the money rules below. A licensed provider holds and refunds contributions; Givtme holds references and instructions and must never directly hold pooled funds. This restriction comes from the product documents; the earlier scope's attribution of a separate prohibition to root `AGENTS.md` was stale. Current root boundaries still require separate external and catalog transaction flows and clarification of unresolved money rules. Unsupported controls should be hidden or clearly marked until the gate is satisfied.

**Done when:** a guest can contribute from a public, server rendered `/p/{slug}` link in under 60 seconds without signup or OTP, with no platform minimum; the page shows recipient, gift, target, progress, deadline, and a contributor wall with an anonymous option; card, transfer, and USSD payments support verified, idempotent contributions, optional messages, confirmation and sharing; everyone is notified together when funded; concurrency cannot cause accidental excess collection or duplicate fulfilment; provider settlement and refunds reconcile; the refund path is verified before launch, including the specified automatic refund within 48 hours of a missed deadline, subject to resolving the conflict below.

1. [ ] Design it (spec): `/architect gift pooling`

Code to assess for reuse: `components/wishlist/AddItemSheet.tsx`, `components/product/ProductDetail.tsx`, `app/api/checkout/route.ts`, `app/api/flutterwave/webhook/route.ts`, `lib/orders/`. No pooling implementation exists to continue.

Dependency: reuse verified sharing, guest identity, notifications, eligible gift data, and fulfilment contracts from features 3, 4, 7, 9, and 10. Design must decide catalog versus external eligibility, target pricing and price changes, variants, delivery costs, deadline limits, excess funding, recipient details, and who fulfils the gift. The business case proposes a 3 to 5 percent platform fee with processing passed through separately; the exact rate and fee/refund accounting remain unresolved. The build document offers organiser top up, downgrade, or refund after failure but also requires automatic refunds within 48 hours. Resolve their compatibility before implementation; do not silently drop the refund criterion. Contributor anonymity and real payments are already decided. External gifts must not enter catalog checkout, and no wallet is implied.

## Week 11: Fulfilment and reveal

### 10. Fulfilment and reveal · in-progress · needs a decision

**Work:** Complete existing orders, tracking, notifications, and gift acknowledgments; migrate date estimates to promised windows and add courier delivery photo capture. Existing order types and server projections carry tracking and estimated delivery fields. Their presence does not establish window scheduling or the photo loop.

**Done when:** catalog orders reach the responsible vendor or warehouse, are wrapped with the giver's note, and are delivered inside a supported promised window; every completed order has a delivery photo and giver confirmation; the receiver gets a gentle thank you prompt; both can save the date for next year; giving history records what was given, to whom, and when; missed promises and failures are visible for operational recovery. Any gentle streak stays factual and absent from condolence journeys.

1. [ ] Design it (spec): `/architect fulfilment and reveal`

Code: `lib/orders/`, `components/order/OrderTracking.tsx`, `app/api/orders/notify/route.ts`, `app/account/orders/`, `lib/thank-you/`, `app/api/thank-you/process/route.ts`.

Dependency: feature 9 captures windows and notes before week 11; operational capacity, courier handoff, photo consent and access, retention, and service/refund rules need design. Do not apply a catalog delivery promise to an external affiliate purchase that Givtme does not fulfil. The meaning of completion evidence for those external purchases remains explicit decision work.

## Week 12: Launch hardening

### 11. Launch hardening · planned

**Work:** Harden and verify the completed journeys using existing tests and operational controls. This is a release pass across the product, not a replacement platform.

**Done when:** public pages meet the stated 3G budget on a midrange Android device, low bandwidth states and keyboard journeys work, public page load tests pass, privacy boundaries and payment/notification idempotency are verified, reminder backlog and failed operations are observable, WhatsApp templates are approved and live, and contact consent/deletion and condolence behavior pass review. Pool launch additionally requires feature 6's satisfied gates and verified refunds; an unmet gate remains visible and prevents activating that capability.

1. [ ] Design it (spec): `/architect launch hardening`

## Later roadmap

Multi currency and the full diaspora currency corridor, corporate dashboard, mascot animations, Givtme Wrapped, ads platform, and native mobile apps remain outside the initial twelve week build unless explicitly authorized. Corporate sales, vendor recruitment, and diaspora demand experiments in the business case do not imply building their later software now. Naira commerce and delivery photos still serve diaspora givers in the initial product. Character design and sticker concepts can inform the brand without making animation a launch dependency.

## Decisions and release checks

The current product specification settles the initial build, the core guest journey, real pooling, visibility modes, reminder ladder and cap, manual unfurl fallback, mandatory delivery photos, and the measurement plan. The table now follows its foundation, reminders, wishlists, guest flow, pooling, fulfilment, and hardening sequence. Start early approval work alongside foundation design. No governing feature specs were found under `docs/specs/`; product intent is settled in many areas, but migration and architecture still need feature specs.

Genuinely unresolved decisions are narrower: public search indexing versus anonymous link access; migration of legacy invites and their identity bindings; contact discovery and private list protection; reminder missed window and lifecycle behavior; unknown or foreign price handling; pool eligibility, pricing, fees, settlement, excess funding, and the failed deadline/refund conflict; delivery capacity and service/refund prices; photo consent and external purchase completion evidence. The five minute sale grace conflict recorded in root `AGENTS.md` is not answered by the product documents and remains open. These decisions gate affected implementation, not planning of the capability. Maintain separate external and catalog flows and current Naira formatting throughout.

Prior scope verification, retained as historical evidence: 37 existing tests passed across five files covering the scrape route, price parser, reminder email builder, wishlist validation, and important date validation. The initial test invocation hit sandbox filesystem restrictions; the authorized retry passed. This reconciliation did not rerun those tests or certify live database, delivery, merchant scrape, or browser journeys. Dedicated shared access, reminder worker, scheduling recovery, and real adapter contract coverage remain part of completion. Repository migrations do not prove deployed schema.

## Legend

`existing` is retained implementation. `in-progress` is partial implementation with remaining work. `planned` is new work awaiting design. None of these means production verification was completed by this planning pass.

Each feature awaiting design has one design entry command. `needs a decision` identifies the unresolved choices described in its section, not a request to redecide product requirements already supplied. Every active change needs a spec to capture migration and acceptance details. Its spec can add build milestones, verification, and tests. The next recommended step in a fresh session is `/architect platform model and light setup`, with measurement and early messaging approvals alongside it. Existing sharing hardening and owner reminder repairs can proceed where those contracts are independent. Your decisions can change order or rigor without rebuilding the existing application.
