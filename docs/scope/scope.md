# Scope: Givtme occasion gifting

You already have an occasion gifting application with a store. This scope reuses that foundation to complete the specified platform, including real gift pooling behind its implementation gates.

**Build approach:** Tracer Bullet (recommended, finish one real path through the existing application at a time).
**Workflow:** Beta (recommended, verify behavior and run relevant tests after development). Sharing, guest checkout, pooling, and the new wishlist money and privacy flows use GA, adding independent review and change documentation.
**Planning basis:** Reconciled on 2026-09-17 against root `AGENTS.md`, [product precedence and priorities](../product/README.md), [Experience Design](../product/02-experience-design.md), [User Journey & Build Specification](../product/03-user-journey-and-build-specification.md), [Business Case & Financial Model](../product/01-business-case-and-financial-model.md), and [The Story](../product/04-the-story.md). Experience Design takes precedence over the build specification, followed by the business case and brand narrative. Product requirements remain in those documents. Earlier repository findings are retained; statements in the product documents that a capability is absent do not erase working code.

**Sequence:** Feature numbers remain stable. Table and section order follow the product's twelve week sequence, not a fresh twelve weeks of rebuilding. Gates can change delivery dates without removing a capability from the plan. No feature implementation is authorized by this scope update.

**Scope addition, 2026-09-25:** You want items added by link or manually to populate the Gift Museum, and Givtme to source and deliver gifts not already offered there, with the giver paying through the platform. Feature 5 supplies item details; new feature 12 owns Museum intake and platform sourcing. This extends the earlier external affiliate journey. Product documents and affected specs need reconciliation before implementation. Their current transaction boundaries describe existing behavior, not a reason to omit this requested capability.

**Wishlist flow planning, 2026-09-25:** This next slice captures `gifvtme-wishlist-flow-spec.md`, supplied from your Downloads folder, as proposed product behavior. You confirmed that fund custody and the conflicting refund, visibility, and sourcing rules remain explicit decision gates. Existing requirements remain active until reconciled. Statements inside the supplied file are planning input, not authorization to implement them or change governing product documents and specs. Existing feature numbers, statuses, and recorded confirmations remain intact.

**Slice order:** Resolve the shared policy gates during design, then prove one linked gift through configured pricing, payment, sourcing, and delivery using features 13 and 12. Extend that path with manual modes (14), item funding (6), owner activity (16), payouts (15), and closure resolution (17). Design closure and payout contracts before accepting contributions. The existing calendar is historical sequencing, not a promise that these additions fit the same twelve weeks. Mobile access, keyboard use, public page performance, private data protection, and outcome measurement inherit features 3, 8, and 11.

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
| 13 | Configurable gift pricing | Wishlist slice 1 | in-progress |
| 12 | Wishlist items in the Gift Museum and platform sourcing | Wishlist slice 1 | planned |
| 14 | Manual gift modes and sourcing outreach | Wishlist slice 2 | planned |
| 6 | Gift pooling | Weeks 9 to 10, gated | planned |
| 16 | Owner contribution activity | Wishlist slice 3, with pooling | planned |
| 15 | Recipient cash payouts | Wishlist slice 4, gated | planned |
| 17 | Owner closure and partial funding resolution | Wishlist slice 5, gated | planned |
| 10 | Fulfilment and reveal | Week 11 | in-progress |
| 11 | Launch hardening | Week 12 | planned |

`existing` means implementation is present and retained, not that this pass certified its deployment. There are 2 existing, 8 in-progress, and 7 planned features. This pass retains 12 features and adds 5, with no duplicate feature or drift enrollment. Nothing is marked done or dropped. Pooling has presentation controls but no functional flow found. Migration changes incompatible behavior, completion fills a partial journey, hardening improves reliability or privacy, and new implementation supplies missing capability. A feature can contain more than one kind of work.

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

Scope extension: both successful link capture and manual entry feed feature 12 with the item name, image, entered or fetched price, and original link when available. Missing metadata remains editable. Manual items can be saved without a product link. Capturing a price does not establish the amount Givtme will charge to source and deliver it.

### 9. Guest gifting and delivery promises · in-progress · GA

**Work:** Complete the wishlist gift path behind the existing authentication boundary, retaining catalog pricing, variants, payment verification, retry handling, and order machinery. Browsing a shared wishlist stays public; reserving and buying require an account, with the purchase context carried across signup by a server held intent rather than the current `localStorage` association. The shipping form has delivery instructions but no promised window or gift message contract.

**Done when:** a visitor browses a shared wishlist without an account, and is prompted to sign up or sign in when they reserve or buy, returning after authentication to the exact gift and step they chose rather than a generic page; they then buy a catalog gift through confirmation and order access; external gifts retain affiliate redirects and purchase marking; guest claims and retries remain secure and idempotent; recipient details, a real delivery window, gift note, wrapping choice, and surprise handling survive through fulfilment; address visibility is restricted to its permitted purchase purpose; signup is a soft offer after gift selection or purchase, never a payment toll; prices remain server authoritative and formatted in Naira.

1. [x] Design it (spec): `/architect guest gifting and delivery promises`
2. [ ] Build it: `/develop guest gifting and delivery promises`
   - [ ] Thread a signed out visitor through signup to a paid gift: claims table with its one active claim index, server held purchase intent with an opaque cookie, the resume step that binds the account and revalidates, authenticated claim API, gift checkout route, checkout deriving the wishlist from the caller's own claim, removal of the localStorage association, and transactional confirm and fail RPCs replacing the webhook's sequential updates. Covers AC-1 to AC-13, AC-15 to AC-20, AC-24, AC-26, AC-27, AC-31, AC-33, AC-34, AC-38
     - Built 2026-09-18: all application code is written and green (type check, lint, build, and 180 tests). Left unticked because `gifvtme_migration_026_gift_claims_and_intents.sql` and `gifvtme_migration_027_gift_order_transactions.sql` have not been applied to a database, so nothing in the slice runs yet. Apply both, confirm the schema is live, then tick. Code in `lib/gift/`, `app/api/gift/intent/`, `app/gift/resume/`, `app/api/wishlists/items/[itemId]/claim/`, `app/w/[id]/gift/[itemId]/checkout/`, `components/checkout/GiftCheckoutForm.tsx`.
   - [ ] Recipient address and its privacy boundary: owner set destination with owner only policies, the projection function the buyer reads instead, the frozen order snapshot, and real delivery windows. Covers AC-22, AC-23, AC-25, AC-28
   - [ ] Confirmation and lifecycle: payment confirmation email sent once, the sweep releasing expired claims and cleaning up intents, and claim release when an order is cancelled or refunded. Covers AC-14, AC-16, AC-18, AC-35, AC-36
   - [ ] Migration and hardening: backfill of existing intent flags into claims, claim and intent rate limits, owner side mid flight changes, the neutral contact audit, and a policy diff proving order authorization is unchanged. Covers AC-15, AC-21, AC-29, AC-30, AC-32, AC-37
3. [ ] Verify it: `/check verify guest gifting and delivery promises`
4. [ ] Test it: `/test guest gifting and delivery promises`
5. [ ] Review it (fresh model): `/check review guest gifting and delivery promises`
6. [ ] Document it: `/document guest gifting and delivery promises`

Spec: [Guest gifting and delivery](../specs/0002-guest-gifting-and-delivery/index.md).

Code: `app/checkout/page.tsx`, `app/api/checkout/route.ts`, `app/api/checkout/route.test.ts`, `app/api/flutterwave/webhook/route.ts`, `components/checkout/CheckoutForm.tsx`, `lib/checkout/validation.ts`, `lib/orders/`.

Dependency: features 3 and 7 provide the guest access and claim model; agree the operational window and recipient data contracts with feature 10 during design. Guest order access must not weaken owner authorization. Service prices and the existing five minute sale grace period remain decision gates for affected pricing changes.

## Wishlist slice 1: Price and source one gift

### 13. Configurable gift pricing · in-progress · GA

Show a selling price derived from the source or owner entered price plus a configurable markup. Reuse one pricing policy across linked, manually sourced, and cash paths while allowing distinct rates.

**Done when:** authorized operators can tune rates without a code release; linked and manually sourced prices apply the selected calculation; manual cash uses a configurable percentage; Gift Museum catalog prices receive no additional markup; contributors see the payable amount and owners see applicable payout deductions; committed amounts remain explainable after rates change.

Spec: [Configurable gift pricing](../specs/0003-configurable-gift-pricing/index.md).

Code in `lib/pricing/`, `app/admin/pricing/`, `app/api/admin/pricing/`, and `gifvtme_migration_030_configurable_gift_pricing.sql`. Initial rate controls and linked estimate implementation added on 2026-09-28; target database application and verification remain pending.

- [x] Design it (spec): `/architect configurable gift pricing`
- [ ] Build it: `/develop configurable gift pricing`
  - [ ] Establish pricing records, exact calculations, admin previews and publication, and one linked gift estimate. (AC-1, AC-2, AC-3, AC-4, AC-15, AC-17, AC-18, AC-19)
  - [ ] Add confirmed quotes, current selection, history, expiry, safe display and replacement after supplier changes. (AC-8, AC-9, AC-10, AC-11, AC-13, AC-15, AC-16, AC-17, AC-19)
  - [ ] Integrate feature 12's sourcing checkout and delivery amendments, including locked amounts, safe unpaid retirement and reconciliation. (AC-3, AC-7, AC-12, AC-13, AC-14, AC-16, AC-18, AC-19)
  - [ ] Add manual, cash and partial payout pricing through the owning mode, funding and payout features. (AC-2, AC-4, AC-5, AC-6, AC-11, AC-13, AC-15, AC-19)
  - [ ] Complete candidate migration, retire old price authorities, align operator guidance and verify rollout and rollback. (AC-7, AC-15, AC-17, AC-18, AC-19)
- [ ] Verify it: `/check verify configurable gift pricing`
- [ ] Test it: `/test configurable gift pricing`
- [ ] Review it (fresh model): `/check review configurable gift pricing`
- [ ] Document it: `/document configurable gift pricing`

**Confirmed design and dependencies:** medium to large. Spec 0003 records the accepted pricing rules; launch rates remain unset until an authorized operator publishes them. Feature 12 supplies sourcing checkout and delivery settlement, feature 14 supplies manual mode identity, and features 6, 15 and 17 supply funding, payout and closure contracts. Those integrations remain release gates. Existing catalog sale timing and its separate grace decision remain unchanged.

### 12. Wishlist items in the Gift Museum and platform sourcing · planned · needs a decision · GA

You can add a gift by pasting its link or entering its name, image, and price manually. These items feed the Gift Museum, and a giver can pay through Givtme for the platform to source and deliver a gift that is not already in its offering.

**Done when:** both item entry paths reach Museum intake without creating duplicate products; product details appear in the Museum immediately without exposing the wishlist owner, private list, occasion, or recipient information; listings distinguish gifts available to buy from gifts needing sourcing confirmation; a sourcing request preserves the requested item and variant; payment becomes available only after Givtme confirms availability and the total including sourcing and delivery, which the giver sees before paying; verified payment leads to one sourcing order, procurement, and tracked delivery; unavailable items, changed prices, cancellation, and refunds have clear outcomes; the wishlist reflects actual purchase and fulfilment without duplicate purchases.

1. [ ] Design it (spec): `/architect wishlist items in the Gift Museum and platform sourcing`

**Placement and effort:** large because publication, pricing, payments, procurement, and delivery cross existing features. Inherit the Tracer Bullet approach, starting with one saved item through sourcing and delivery. GA is recommended because this handles payments and private wishlist information. Design alongside features 5 and 9, establish the fulfilment contract with feature 10, and revisit delivery dates rather than assuming this fits the existing weeks unchanged.

**Confirmed on 2026-09-25:** publish product details in the Gift Museum immediately when a linked or manual item is added, without exposing its wishlist owner. Publication does not make the wishlist public or reveal its personal context. Givtme confirms availability and the full price including sourcing and delivery before the giver can pay. Museum publication alone does not mean an item is available or ready for payment. Fetched and manually entered prices remain indicative until that confirmation.

**Decisions still open:** sourcing charges, quote validity, price changes after confirmation, unavailable products, substitutions, cancellation, and refund terms. Whether affiliate purchase remains an alternative also needs a decision. Architecture should define duplicate matching, safe public product fields, handling of personal information embedded in user supplied names or images, and removal or correction of published items without delaying the agreed immediate publication flow.

**Dependencies and migration:** feature 5 owns metadata and manual capture; feature 7 owns Museum discovery; feature 3 owns wishlist visibility and claims; feature 9 supplies payment and order foundations; feature 10 owns fulfilment. Reconcile [platform model AC-13](../specs/0001-platform-model-light-setup/index.md) and [guest gifting AC-26](../specs/0002-guest-gifting-and-delivery/index.md), which currently retain the affiliate only external path. Architecture must define how a sourced offer becomes payable while retaining its original source, rather than bypassing the current external item checkout rejection. Reconcile the product source of truth and repository transaction guidance before implementation. This scope pass does not change those files or application code.

A single giver paying for sourcing is distinct from pooled contributions. Feature 6 must explicitly define sourced gift eligibility and target pricing before pooling is enabled for these items; its existing provider custody and refund gates still apply. No wallet or direct custody of pooled funds is implied.

**Proposed flow extension:** linked items are treated as sourceable without an admin sourceability decision. A contribution or claim places the item in the fulfilment queue; Givtme purchases, receives, brands, and delivers it. The file separately says procurement starts automatically at full funding. Queue entry, a claim, and permission to spend therefore need distinct rules before implementation. Automatic link pricing also conflicts with the earlier confirmation gate recorded above. Feature 13 owns pricing, feature 14 owns manual outreach, and feature 6 owns funding completion.

**Gift Museum path:** selecting an existing curated catalog item adds its complete details and existing price, with margin already included. It needs no sourcing review or sourcing queue. Paid fulfilment still uses feature 10. Immediate Museum publication of a new owner supplied item must not accidentally classify it as stocked, fully specified catalog inventory.

## Wishlist slice 2: Choose how a manual gift is fulfilled

### 14. Manual gift modes and sourcing outreach · planned · needs a decision · GA

You can create a manual item with title, image, description, and price. On that same form, the owner chooses the actual gift by default or cash, with the choice fixed at creation; the item appears on the wishlist immediately.

**Done when:** mode choice persists and contributors cannot change it; sourced mode creates one admin outreach session and sourcing queue entry to collect model, size, variant, and source details; admin classification and owner confirmation send sourceable goods to procurement and items that cannot be sourced to feature 15; cash mode skips sourcing outreach; repeated saves do not duplicate outreach.

1. [ ] Design it (spec): `/architect manual gift modes and sourcing outreach`

**Decisions and effort:** medium to large. Define collection eligibility while classification is pending, owner confirmation for items classified as impossible to source, and what creation lock permits after editing or closure. Decide operational queue states and response targets; the file suggests pending, sourcing, purchased, shipped, and delivered but does not settle them. Reuse feature 5's manual capture and feature 12's procurement. Existing capture uses `origin: external` for manual and linked items and has no fulfilment mode in its validation contract; source metadata and fulfilment mode need design without bypassing the current transaction discriminator.

## Weeks 9 to 10: Gift pooling, implementation gated

### 6. Gift pooling · planned · needs a decision · GA

**Work:** New implementation of real monetary pooling, as settled by the product documents. `AddItemSheet` has a local group payment toggle that is not submitted or persisted. `ProductDetail` has a checked, read only group payment checkbox. No pool records, contribution accounting, contributor checkout, settlement, or refund flow was found. The evergreen item pool is a reusable item collection, not money pooling. Effort is large; payment architecture and unresolved settlement rules govern the estimate.

This is part of the initial product plan, not an optional pledge experiment. The gate is a reviewed payment and escrow architecture, legal review before any money moves, and resolution of the money rules below. A licensed provider holds and refunds contributions; Givtme holds references and instructions and must never directly hold pooled funds. This restriction comes from the product documents; the earlier scope's attribution of a separate prohibition to root `AGENTS.md` was stale. Current root boundaries still require separate external and catalog transaction flows and clarification of unresolved money rules. Unsupported controls should be hidden or clearly marked until the gate is satisfied.

**Done when:** a guest can contribute from a public, server rendered `/p/{slug}` link in under 60 seconds without signup or OTP, with no platform minimum; the page shows recipient, gift, target, progress, deadline, and a contributor wall with an anonymous option; card, transfer, and USSD payments support verified, idempotent contributions, optional messages, confirmation and sharing; everyone is notified together when funded; concurrency cannot cause accidental excess collection or duplicate fulfilment; provider settlement and refunds reconcile; the refund path is verified before launch, including the specified automatic refund within 48 hours of a missed deadline, subject to resolving the conflict below.

1. [ ] Design it (spec): `/architect gift pooling`

Code to assess for reuse: `components/wishlist/AddItemSheet.tsx`, `components/product/ProductDetail.tsx`, `app/api/checkout/route.ts`, `app/api/flutterwave/webhook/route.ts`, `lib/orders/`. No pooling implementation exists to continue.

Dependency: reuse verified sharing, guest identity, notifications, eligible gift data, and fulfilment contracts from features 3, 4, 7, 9, and 10. Design must decide catalog versus external eligibility, target pricing and price changes, variants, delivery costs, deadline limits, excess funding, recipient details, and who fulfils the gift. The business case proposes a 3 to 5 percent platform fee with processing passed through separately; the exact rate and fee/refund accounting remain unresolved. The build document offers organiser top up, downgrade, or refund after failure but also requires automatic refunds within 48 hours. Resolve their compatibility before implementation; do not silently drop the refund criterion. Contributor anonymity and real payments are already decided. External gifts must not enter catalog checkout, and no wallet is implied.

**Proposed item funding extension:** track money and funding state independently for each gift. Leaving a partial item open keeps collecting; reaching the target triggers the applicable fulfilment or payout path without another owner choice. Closing one gift cannot move money to another or change another gift's state. The file proposes no contributor refunds at any funding state and retaining closed partial funds for feature 17. This conflicts with the refund acceptance criteria above and remains unresolved, alongside custody. The general instruction to source all fully funded gifts also conflicts with its cash and nonphysical paths; confirm the completion action for each mode. A claim is not a verified contribution.

## Wishlist slice 3: Let the owner follow contributions

### 16. Owner contribution activity · planned · needs a decision · GA

Notify the owner when someone commits to buying or contributing, and show who gave how much for each item so the owner can thank them.

**Done when:** agreed commitment events produce one owner alert each; the owner can inspect each permitted contributor and amount for the correct gift; pending promises and verified money are distinguishable; unrelated users and public responses receive no private contribution details.

1. [ ] Design it (spec): `/architect owner contribution activity`

**Decisions and effort:** medium. Features 3 and 9 currently hide claims and giver identity from the owner, and pooling offers anonymity. Decide owner visibility, anonymous contributions, alert timing, and the meaning of commitment before changing these boundaries. Reconcile spec 0002 AC-21 and AC-30 and their verification scenarios. Reuse notification capabilities; feature 8 measures commitments and completed contributions separately. Release alongside the applicable contribution flow after these decisions.

## Wishlist slice 4: Pay the recipient

### 15. Recipient cash payouts · planned · needs a decision · GA

Pay the recipient for manual cash gifts and manually sourced items that admin determines cannot be procured, such as a trip or course. These paths involve no physical purchase or delivery by Givtme.

**Done when:** completed cash funding produces one reconciled recipient payout with the approved margin treatment; items that cannot be sourced retain the marked up listed price and follow their approved payout trigger; failed or retried payouts cannot duplicate payment; the owner can see the amount and status without exposing recipient payment details publicly.

1. [ ] Design it (spec): `/architect recipient cash payouts`

**Decisions and effort:** large. Resolve custody first, then recipient verification, payout destination, timing, failed transfers, and whether the nonphysical path pays each contribution directly or waits for the target. The file specifies completion for cash mode but leaves that timing unclear for items that cannot be sourced. Feature 13 distinguishes a markup added to a target from a deduction taken from raised funds. Feature 17 reuses payout execution for an approved partial closure outcome.

## Wishlist slice 5: Resolve an owner closed gift

### 17. Owner closure and partial funding resolution · planned · needs a decision · GA

Only the owner can close or cancel a listing, including after contributions. A closed partial gift triggers admin outreach so the owner can choose cash with a percentage deducted or an alternative gift within the amount raised.

**Done when:** contributors cannot close the listing regardless of their contribution; closure stops new contributions without mixing item funds; one outreach session records the owner's choice; cash follows feature 15 and an alternative purchase follows feature 12 within the available budget; payment arriving during closure has a defined outcome; repeated actions cannot spend or pay the same funds twice.

1. [ ] Design it (spec): `/architect owner closure and partial funding resolution`

**Decisions and effort:** large. Resolve the proposed no refund policy against feature 6 before implementation. Define zero funding closure, fully funded cancellation, procurement already in progress, failed sourcing, unavailable alternatives, unresponsive owners, and late payment settlement. Clarify listing closure versus releasing a reservation or cancelling an order; spec 0002 AC-17, AC-29, and AC-35 cover different actions and cannot be silently replaced. The payout percentage is provisional and belongs to feature 13. Design this resolution before pooling launch even though its build follows reusable payment and procurement paths.

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

**Wishlist flow release extension:** features 12 to 17 and the pooling extension need an agreed policy for custody, refunds, price confirmation, owner visibility, payout timing, and fully funded cancellation before their affected flows launch. Verify item isolation, contribution and closure races, one procurement or payout per funded outcome, operator recovery, and rate changes. Existing requirements for verified refunds remain active until explicitly reconciled.

## Later roadmap

Multi currency and the full diaspora currency corridor, corporate dashboard, mascot animations, Givtme Wrapped, ads platform, and native mobile apps remain outside the initial twelve week build unless explicitly authorized. Corporate sales, vendor recruitment, and diaspora demand experiments in the business case do not imply building their later software now. Naira commerce and delivery photos still serve diaspora givers in the initial product. Character design and sticker concepts can inform the brand without making animation a launch dependency.

## Decisions and release checks

The current product specification settles the initial build, the core guest journey, real pooling, visibility modes, reminder ladder and cap, manual unfurl fallback, mandatory delivery photos, and the measurement plan. The table now follows its foundation, reminders, wishlists, guest flow, pooling, fulfilment, and hardening sequence. Start early approval work alongside foundation design. Specs 0001 and 0002 now exist; the earlier statement that no feature specs existed is stale. The supplied wishlist flow introduces the policy conflicts recorded here. Product document and spec reconciliation belongs to the relevant design work before affected implementation resumes.

Genuinely unresolved decisions are narrower: public search indexing versus anonymous link access; migration of legacy invites and their identity bindings; contact discovery and private list protection; reminder missed window and lifecycle behavior; unknown or foreign price handling; pool eligibility, pricing, fees, settlement, excess funding, and the failed deadline/refund conflict; delivery capacity and service/refund prices; photo consent and external purchase completion evidence. The five minute sale grace conflict recorded in root `AGENTS.md` is not answered by the product documents and remains open. These decisions gate affected implementation, not planning of the capability. Maintain separate external and catalog flows and current Naira formatting throughout.

Prior scope verification, retained as historical evidence: 37 existing tests passed across five files covering the scrape route, price parser, reminder email builder, wishlist validation, and important date validation. The initial test invocation hit sandbox filesystem restrictions; the authorized retry passed. This reconciliation did not rerun those tests or certify live database, delivery, merchant scrape, or browser journeys. Dedicated shared access, reminder worker, scheduling recovery, and real adapter contract coverage remain part of completion. Repository migrations do not prove deployed schema.

For this requested slice, the recommended first design entry is `/architect configurable gift pricing`, coordinated with feature 12's sourceability and payment gate. Custody, refund, and owner visibility decisions can remain open during planning, but their dependent implementations cannot assume an answer. No additional capability is deferred by this pass; existing later roadmap boundaries remain. No web research, application tests, or live deployment verification was performed for this documentation update.

## Legend

`existing` is retained implementation. `in-progress` is partial implementation with remaining work. `planned` is new work awaiting design. None of these means production verification was completed by this planning pass.

Each feature awaiting design has one design entry command. `needs a decision` identifies the unresolved choices described in its section, not a request to redecide product requirements already supplied. Every active change needs a spec to capture migration and acceptance details. Its spec can add build milestones, verification, and tests. The next recommended step in a fresh session is `/architect platform model and light setup`, with measurement and early messaging approvals alongside it. Existing sharing hardening and owner reminder repairs can proceed where those contracts are independent. Your decisions can change order or rigor without rebuilding the existing application.
