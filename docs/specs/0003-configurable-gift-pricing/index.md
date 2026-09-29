# 0003. Configurable gift pricing

**Date**: 2026-09-25
**Status**: In Progress
**Revised**: 2026-09-28. Applied the four independent review fixes approved in the design conversation.

## Summary

Let authorized operators change gift pricing percentages without a code release. Show estimates until Givtme confirms a sourced gift and its delivery charge, then preserve the exact quote accepted when payment starts. Keep catalog pricing intact and provide separate calculations for cash gifts and partial cash payouts. This is the pricing contract for scope feature 13; enabling sourcing, contributions, or payouts also requires the contracts owned by those features.

## Requirements

**User stories**

* As an operator, I want to preview and publish rates, so I can adjust pricing and explain earlier amounts.
* As a giver, I want to distinguish an estimate from a confirmed total and approve any replacement before paying.
* As an owner choosing cash, I want to enter what I should receive and see the fee added to the funding target.
* As an operator resolving a partial gift, I want an explicit deduction and recipient amount, without charging two platform fees.

**Acceptance criteria**

* **AC-1**: Existing authorized admins can preview and immediately publish independent percentage rates for linked gifts, manually sourced gifts, cash gifts, and partial cash payouts. Publication records the actor, time, and reason. No second approver or code release is required.
* **AC-2**: A path has no assumed launch rate. Until an operator publishes its rate, its calculated selling price is unavailable and no new payment or payout using that policy may start. An explicitly published zero rate is valid and distinct from a missing rate.
* **AC-3**: Sourced gift markup applies to the confirmed item price only. Delivery is a separate, explicitly confirmed charge. Payment processing costs are absorbed by Givtme and do not increase the displayed total or reduce the promised cash receipt.
* **AC-4**: Source costs retain their supplied precision for evidence and calculation. The resulting gift price rounds to the nearest whole Naira, with halves rounded up. Cash fees and partial payout deductions use the same rounding rule. Displayed and charged amounts agree through `formatPrice()`.
* **AC-5**: A cash owner's entered amount is their intended receipt. The cash fee is added to that amount to produce the funding target. Cash has no physical delivery charge.
* **AC-6**: An eligible partial closure cash payout uses its own rate against verified receipts less completed refunds and reversals. The full calculation is blocked if those funds are already spent or allocated; processing and sourcing costs do not reduce its base. That deduction replaces the original gift or cash fee; it is not stacked with either. Payout eligibility, custody, refunds, and execution remain gated by features 6, 15, and 17.
* **AC-7**: Existing curated catalog products receive no additional markup. Their prices, variants, sale timing, and five minute checkout grace behavior remain with `getActivePrice`. This feature does not ratify or change the separate sale grace decision.
* **AC-8**: Linked and manually sourced gifts show clearly labelled estimates until Givtme confirms availability, the exact gift and variant, the source price and evidence, and delivery. A quote requires a source reference and the time the price was checked. Publication in the Museum alone never makes an estimate payable.
* **AC-9**: A confirmed quote expires 24 hours after confirmation for starting a new payment. Eligible givers share the item's one current quote for its confirmed variant, quantity, and delivery area. Reads and payment acceptance use that explicit current quote and item pricing revision, never an arbitrary historical match. Sharing the quote neither reserves the gift nor expands wishlist access.
* **AC-10**: A detected supplier price increase or decrease before payment withdraws the old quote. A replacement requires fresh confirmation and the giver's explicit acceptance. An old browser tab cannot start payment with the withdrawn quote.
* **AC-11**: Publishing a new rate affects new estimates and new quotes only. Existing confirmed quotes retain their rate until expiry or withdrawal for another reason. Locked payment amounts and historical records never recalculate using a newer rate.
* **AC-12**: Starting payment against a valid accepted quote locks its amount. A successful payment is honoured at that amount, including a delayed verified payment after quote expiry or a supplier price change. Duplicate requests and callbacks create no second charge or pricing commitment.
* **AC-13**: A physical gift displays gift price, delivery, and total. A cash gift displays recipient amount, platform fee, and total. Owners can see applicable payout calculations within their permitted flow. Supplier cost, physical markup, other buyers' orders, and private recipient data are not exposed by pricing responses.
* **AC-14**: A known delivery area and an operator confirmed delivery charge are sufficient for a sourced quote. A full address can follow later. An address outside that area holds fulfilment for a revised delivery charge and explicit giver approval; no additional amount is charged automatically.
* **AC-15**: Published rate versions, confirmed quotes, payment price snapshots, and pricing events are retained, including expired and withdrawn quotes. Operators can correct inputs and create a replacement quote but cannot overwrite the final total or alter historical monetary facts.
* **AC-16**: Rate publication, quote replacement, and payment binding handle concurrent requests atomically. Confirmation is bound to a server issued preview of the exact inputs and calculated total; changed inputs require a fresh preview. A mismatched quote context cannot commit. A definitively failed initialization with no session can retire an unpaid attempt atomically while retaining its history; an unknown outcome remains blocked until reconciliation.
* **AC-17**: Admin pricing controls and customer price states work with keyboard input and on mobile. Missing rates, incomplete source evidence, unknown delivery charges, changed prices, expired quotes, and network failures have explicit states. No default rate or guessed delivery charge fills a missing value.
* **AC-18**: Migration removes the Museum's environment based default markup, delivery buffer, coarse rounding, and final price override from the new pricing path. Existing paid and pending orders keep their amounts. External items remain excluded from catalog checkout until the separate sourcing contract and governing transaction guidance are reconciled.
* **AC-19**: The actual payment path checks quote ownership context, wishlist visibility, variant, delivery area, payment amount and currency on the server. Direct database access and forged client amounts cannot bypass those checks. Existing catalog order authorization and surprise protections do not weaken.

## Decision

**Chosen option**: Option 2, introduce versioned pricing alongside existing commerce, then move sourced gift estimates and quotes onto it in controlled slices.

Use Supabase for pricing records, the existing Next.js admin area for controls, and a single exact calculation module under `lib/pricing/`. Continue using existing order and Flutterwave services through explicit pricing adapters. No new pricing vendor, queue, or payment provider is introduced.

**Implementation skills**: `supabase` (`.agents/skills/supabase/`) and `supabase-postgres-best-practices` (`.agents/skills/supabase-postgres-best-practices/`). These informed transaction boundaries, exact monetary types, database privileges, and indexes.

The business rules above were chosen in the design conversation. Field names, endpoint names, percentage precision, validation bounds, transaction details, and module placement below are engineering recommendations for review with this draft.

## Feature design

### Boundaries and existing checkout contract

This is a separate spec linked to [spec 0002](../0002-guest-gifting-and-delivery/index.md). Its catalog price authority (AC-33), external rejection (AC-26), buyer ownership (AC-32), recipient privacy (AC-22 and AC-23), and verified payment behavior remain in force. A quote ID is a reference to server data, never permission to bypass those rules.

| Path | Source of pricing inputs | Output and integration boundary |
| --- | --- | --- |
| Existing curated catalog | Sanity product and selected variant | Existing `getActivePrice`; no new rate, quote requirement, or sale rule |
| Linked sourced gift | Existing candidate and item association; operator checked NGN item cost | Estimate, then confirmed quote; feature 12 supplies the sourcing offer and payment adapter |
| Manual sourced gift | Owner entered indicative cost; operator checked NGN item cost | Same pricing engine with the manual sourced rate; feature 14 supplies the locked fulfilment mode |
| Manual cash gift | Owner's whole Naira desired receipt | Cash fee and target; features 6 and 15 supply collection and payout commitments |
| Eligible partial cash payout | Server verified confirmed funds raised for that gift | Separate deduction and net amount; features 6 and 17 decide eligibility and feature 15 executes |

`wishlist_items.origin` stays `external` or `catalog`. Neither a candidate's publication status nor a quote changes it. Do not infer curated catalog inventory from the existence of a Sanity draft created by candidate promotion. Preserve source provenance and inventory classification through feature 12's resolver.

The current manual item contract has no locked cash versus sourcing mode. Such items remain ineligible for mode specific quotes until feature 14 supplies that fact. Likewise, this spec supplies cash calculations and fee snapshots, not a pool ledger, wallet, payout endpoint, or permission to hold funds.

### Calculations

All customer totals are NGN. Rates are integer basis points, where 100 basis points mean 1 percent, allowing increments of 0.01 percent. Use integer scaled arithmetic or Postgres `numeric`, never binary floating point for an authoritative result. Persist `calculation_version = 'gift-pricing-v1'` with each quote and payment snapshot.

For nonnegative exact values, `R(x) = floor(x + 0.5)` is rounding to a whole Naira. There is no rounding to 100 or 500 and no automatic rounding upward except the half boundary.

| Calculation | Formula |
| --- | --- |
| Physical gift price | `gift = R(source_ngn * (10000 + rate_bps) / 10000)` |
| Physical total | `total = gift + delivery_ngn` |
| Cash fee | `fee = R(recipient_ngn * cash_rate_bps / 10000)` |
| Cash target | `target = recipient_ngn + fee` |
| Partial closure base | `confirmed_raised_ngn = verified_receipts_ngn - completed_refunds_ngn - reversals_ngn` |
| Partial closure deduction | `deduction = R(confirmed_raised_ngn * partial_rate_bps / 10000)` |
| Partial cash receipt | `receipt = confirmed_raised_ngn - deduction` |

Delivery, desired cash receipt, and new cash calculation inputs use whole Naira. Preserve source costs to two decimal places, calculate markup before rounding the gift price, and derive the rounding adjustment from the original inputs. The stored calculation must reconstruct the total exactly. Do not round the source first. A positive fee may round to zero; there is no undisclosed minimum fee. A zero net result is displayed as zero and does not create a zero amount provider transfer.

The partial payout adapter supplies a reconciled `funds_snapshot` from feature 6: `gift_id`, `ledger_revision`, `verified_receipts_ngn`, `completed_refunds_ngn`, `reversals_ngn`, `available_unallocated_ngn`, and `recorded_at`. Receipts contain verified settled contributions only. Refund and reversal amounts are completed, disjoint ledger reductions of those receipts, not pending requests or overlapping counts of the same money. A negative resulting base is a ledger error and blocks resolution.

Processing charges, sourcing costs, previous payouts and other platform fees are not deducted to shrink the agreed calculation base. Instead, funds already spent, paid out, reserved for a refund, or allocated elsewhere reduce `available_unallocated_ngn`. It must cover the full `confirmed_raised_ngn`, meaning the recipient receipt plus the separate deduction. Otherwise return `insufficient_unallocated_funds`; show the unavailable resolution, never silently reduce the promised receipt or borrow another gift's funds. Processor expenses belong to Givtme's accounting, not a deduction from the gift balance. The settlement adapter must prove it can honour the calculated receipt and fee allocation before execution.

Feature 17's resolution and feature 15's payout operation must atomically reserve this full base against the reviewed `ledger_revision` and one closure operation ID. A changed ledger revision requires a fresh calculation and owner review. A replay resolves the existing allocation; a new key cannot allocate the same closure twice. This fixes the pricing definition while leaving custody, ledger storage and transfer execution with their owning features. If a future ledger contains fractional Naira, this whole Naira contract must be reconciled before that adapter is enabled; do not round away or appropriate existing funds.

Validation recommendations: source costs are positive `numeric(14,2)`; whole Naira outputs and inputs are nonnegative `numeric(14,0)`; reject overflow before persistence or provider calls. Markup and cash rates accept 0 through 50,000 basis points, retaining the existing admin markup ceiling of 500 percent. Partial payout rates accept 0 through 9,999 basis points. Reject negative, nonfinite, excessive precision, or out of range inputs rather than coercing them. Cash desired receipt and physical payable totals must be positive. Delivery can explicitly be zero.

Example values below are test fixtures, not launch rates:

| Case | Inputs | Result |
| --- | --- | --- |
| Sourced gift | Source 10,000; rate 10%; delivery 1,500 | Gift 11,000; total 12,500 |
| Source precision | Source 100.50; rate 10%; delivery 0 | Unrounded gift 110.55; gift and total 111 |
| Half rounding | Source 101; rate 50%; delivery 0 | Unrounded gift 151.50; total 152 |
| Cash | Recipient 10,000; rate 10% | Fee 1,000; target 11,000; recipient 10,000 |
| Partial closure | Confirmed raised 6,000; partial rate 5% | Deduction 300; receipt 5,700, with no second fee |

Physical pricing shows the selling price rather than internal cost or markup. Cash explicitly shows its fee. No processing surcharge is added. This policy introduces no extra sourcing or service fee line; if a separately priced optional service is added later, its own contract must define it before a quote can include it.

### Estimates and confirmation

An estimate uses the current rate and an indicative source amount. It is labelled as an estimate, with delivery marked as awaiting confirmation if unknown. Do not display an apparent all inclusive total when delivery is unknown. A missing rate or amount produces `pricing_unavailable`, not zero and not a legacy default.

For native NGN sources, read the exact candidate `source_price`, not the rounded `converted_price_ngn`. For a foreign source, existing conversion can support an estimate only when an NGN conversion and its provenance exist. If conversion fails, never treat the foreign amount as Naira. An operator must confirm a specific NGN procurement cost for a payable quote. This does not add foreign currency checkout or promise a live exchange rate.

An operator confirms one gift at quantity 1, including exact variant details, availability, NGN procurement cost, sanitized source reference, source check timestamp, delivery area, and whole Naira delivery charge. The source check must be no later than confirmation and within the preceding 24 hours. A supplier reference or documented supplier quote is valid evidence; a product URL is not required for a manually sourced item.

The delivery area contains normalized state, city, and the operator's coverage description when those alone are insufficient. The quote stores a private area key and the coverage text. A full street address is not required and never belongs in a public price response. Until an actual destination record exists, the admin supplied area is explicitly a quoting input, not an invented saved address.

Detecting a source price change is an operator action in this release. There is no promise that a scraper continuously checks a supplier. A successful fetch can flag a possible change for review but cannot silently confirm availability or rewrite a quote. A confirmed change withdraws the old quote and creates a replacement using the current published rate and new inputs. The giver reviews the full replacement total even when it is lower. A lower source cost lowers the calculation at the same rate; if the rate or delivery charge also changed, show the actual combined result rather than promising the total must decrease.

### Records and relationships

Use five new tables and the two existing item columns described below. `id` means a UUID primary key unless stated otherwise. Timestamps use `timestamptz`. Columns are required except those explicitly marked nullable. A foreign key links one record to another and must have an index where it is used for lookup or deletion.

| Table | Fields and relationships |
| --- | --- |
| `gift_pricing_policies` | `key` text primary key, one of `linked`, `manual_sourced`, `manual_cash`, `partial_cash_payout`; `active_version_id` nullable foreign key; `revision` integer; `updated_at`. Seed keys with null active versions, never seed percentages. The active version must belong to the same policy. |
| `gift_pricing_rate_versions` | `id`, `policy_key` foreign key, `version` positive integer, `rate_bps` integer, `published_at`, `published_by` nullable user foreign key, `publisher_audit_id` opaque actor identifier, `reason` text. Unique `(policy_key, version)`. Monetary fields are immutable. One policy has many versions; one version can price many quotes. |
| `gift_price_quotes` | `id`, `wishlist_item_id` nullable foreign key, `subject_audit_id` immutable opaque original item ID, `candidate_id` nullable foreign key, `pricing_path`, `rate_version_id` foreign key, `subject_fingerprint`, `item_pricing_revision` integer, `variant_snapshot` JSON object, `quantity = 1`, `source_amount_ngn`, `source_reference`, `source_checked_at`, `delivery_area_key`, `delivery_area_snapshot` JSON object, `delivery_ngn`, `gift_or_recipient_ngn`, `cash_fee_ngn`, `total_ngn`, `calculation_version`, `confirmed_at`, `expires_at`, `confirmed_by` nullable user foreign key, `confirmer_audit_id`, `status`, `state_revision`, `replaces_quote_id` nullable self reference, `parent_paid_quote_id` nullable self reference, `reason`, `request_key`, `request_hash`. Source evidence and delivery fields are nullable only for cash; cash delivery and physical cash fee are zero. Each gift has many historical quotes; every quote references exactly one rate version. |
| `order_pricing_snapshots` | `order_id` existing order primary and foreign key, `quote_id` unique foreign key, `accepted_by` nullable user foreign key, `acceptor_audit_id`, `accepted_at`, `calculation_version`, `calculation_snapshot` validated JSON object, `total_ngn`, `currency = 'NGN'`. Copy all quote monetary inputs, rate identity, area and variant identity, and rounded outputs, not just the final amount. Monetary snapshots are immutable. Payment outcome remains in the existing order and payment records. |
| `gift_pricing_events` | `id`, `policy_key` nullable foreign key, `quote_id` nullable foreign key, `order_id` nullable foreign key, `actor_user_id` nullable foreign key, `actor_audit_id`, `actor_kind` (`admin`, `buyer`, `system`), `event_type`, `occurred_at`, `reason`, `request_key`, `request_hash`, `preview_nonce` nullable UUID, bounded `details` JSON object. At least one subject reference is required. Append events for publication, confirmation, withdrawal, replacement, payment binding, initialization outcomes, and delivery revision approval. Never put credentials, full addresses, or provider payloads in details. |

Cash uses the same quote shape when its owning feature is ready, with `source_amount_ngn` holding the intended receipt and no fabricated source evidence. Such quotes are created by that feature's authorized server action, identified as a system action in events. Admin confirmation of supplier availability applies to physical sourcing, not cash. Partial payout calculations use the partial policy and an owning payout record in feature 15; do not create a fake order or gift quote to simulate a payout.

Add `wishlist_items.active_price_quote_id` (nullable foreign key to `gift_price_quotes`) and `wishlist_items.pricing_revision` (nonnegative integer, initially zero). They are maintained only by pricing transactions, omitted from client writable item schemas, and do not expand existing public or owner projections. The referenced initial quote must belong to that same item; enforce this with a deferred constraint check or equivalent database function and constraint combination. A delivery amendment never becomes the item's initial quote pointer.

An item has one current confirmed selection, not a menu of concurrently payable variant or area quotes. The operator confirms the exact variant, quantity and quoting area in the current quote after validating the stored sourcing facts. Feature 12's resolver returns that quote's selection and the item pricing revision for reads and acceptance. A new selected variant or delivery area needs a replacement quote and increments the item revision; merely changing a browser picker does not select a different price. Until replacement is confirmed, the new selection is not payable.

`GET /api/wishlists/items/[itemId]/pricing` follows `active_price_quote_id`, verifies the item association, validity and caller visibility, and returns the selected variant label and quantity with its permitted price projection. It never selects the newest or cheapest quote across history. An absent, expired or withdrawn current quote produces the applicable nonpayable state. Acceptance must match both this pointer and `pricing_revision` as well as the quote's state revision. A replacement and its pointer update occur in one transaction. The new quote stores the incremented item revision in `item_pricing_revision`; the returned item revision is that same value. A locked quote stays the current reference for its existing payment continuation; it does not authorize a new buyer to start a session.

`subject_fingerprint` is a server generated digest of original item identity, authoritative pricing path, confirmed variant identity, quantity, and quoted delivery area. It detects mismatched terms but does not choose a quote. Derive item and mode identity from persisted sourcing facts through `PricingSubject`; take the confirmed selection from the explicit current quote. Missing canonical mode or confirmed selection prevents payment. Feature 12 implements this resolver and feature 14 supplies the manual mode; they do not need to invent a selection rule.

Confirmed financial facts are immutable even when lifecycle status changes. Store correction and withdrawal reasons in events. Replace facts with a new quote rather than updating monetary columns. A delivery revision has `parent_paid_quote_id`, keeps the original gift monetary facts and rate, and changes only its delivery context and charge; it is distinct from a new gift purchase.

Enforce at most one `confirmed` initial quote per live `wishlist_item_id` with a partial unique index excluding delivery amendments. The item row and its explicit pointer serialize both confirmation and payment binding; confirmation cannot replace a currently locked initial quote unless the permitted release transition has completed. The fingerprint is not the uniqueness boundary. Permit at most one current delivery revision per paid quote. Expire or withdraw a previous confirmed quote before inserting its replacement in the same transaction; do not put the current time in an index predicate.

Index the active quote foreign key, quote history by `(subject_audit_id, confirmed_at DESC)`, active expiry by `(expires_at) WHERE status = 'confirmed'`, rate versions by policy, and events by subject and time. Enforce unique mutation receipts by actor, operation and request key, retaining the request hash and result identity. Enforce unique consumed `preview_nonce` values on mutation receipts; related audit events reference the receipt rather than consuming its nonce again.

`order_pricing_snapshots.order_id` and its unique `quote_id` association remain permanent historical constraints. They never mean that every historical order blocks another purchase forever. The current item pointer identifies the active initial binding. Retiring a definitively unpaid attempt clears that pointer and changes its quote to `retired_unpaid`, allowing a new quote ID and new order to be created. It never reassigns the old quote to another order. Release after an actual paid cancellation or refund remains subject to feature 12's settled lifecycle contract; neither a quote expiry nor a client request alone releases a paid or uncertain binding.

Retain all published versions, confirmed quotes, snapshots, and events. Item, candidate, or user deletion uses nullable live references plus opaque audit identifiers, without cascading away the monetary record or preventing an otherwise authorized item deletion. Detached quotes cannot be newly used. Full delivery addresses stay in the existing protected fulfilment records. No automatic history purge or legal retention period is introduced here.

### State transitions and concurrency

| From | To | Trigger and rule |
| --- | --- | --- |
| No configured policy | Published version | Admin preview and publication; append version and event, switch active pointer in one transaction |
| Published policy | New published version | Expected policy revision must still match; preserve previous version |
| Estimate | `confirmed` quote | Operator confirmation of complete physical inputs; expiry is confirmation time plus 24 hours |
| `confirmed` | `expired` | Database time is at or after expiry; reads and payment checks enforce this even without a sweep |
| `confirmed` | `withdrawn` | Detected supplier change, lost availability, changed subject or area, deletion, or explicit admin withdrawal |
| `confirmed` | `locked` | Accepted quote binds to one order and immutable snapshot in the payment start transaction |
| `locked` | Remains locked | A session exists, an outcome is unknown, or the same valid unpaid attempt is being retried; order and event records carry the outcome |
| `locked` | `retired_unpaid` | The authorized retirement transaction proves no session or payment exists, no initialization is in flight, and the stale or abandoned unpaid attempt can be cancelled; preserve its snapshot and release only its active binding |
| `withdrawn`, `expired`, or `retired_unpaid` | Terminal | A replacement gets a new ID, timestamps, evidence, and confirmation; no historical quote or snapshot is reused for a different order |

Use short database transactions and a consistent lock order: pricing policy, gift subject or claim, quote, then order. Capture authoritative database time after acquiring the relevant locks. No supplier fetch or provider call runs while database locks are held.

Publication carries an expected policy revision and the purpose specific signed preview described below. Quote confirmation carries that preview, the previewed rate version, expected item pricing revision, and expected current quote ID and state revision, or an explicit expectation that none exists. Return 409 if any expected version changed. Never publish or confirm different financial terms from the preview silently.

Before payment, the server resolves the authenticated buyer's existing purchase context and claim, current visibility, source eligibility, selected variant, and delivery area. The client accepts the displayed `quote_id`, quote state revision and item pricing revision but supplies no authoritative amount, pricing path, or wishlist association. In one transaction, revalidate those facts, bind the quote, create the order through the owning checkout adapter, and write the pricing snapshot and event. The amount comes from the quote. Repeated use of the same operation key returns the same result; a different payload with that key returns 409.

The provider request runs after this commit, using the existing order identity for retry and reconciliation. A provisional binding is necessary before calling Flutterwave so two givers cannot create two sessions. The initialization adapter records an attempt ID, its order and provider reference, in flight state, result (`session_exists`, `no_session`, or `unknown`), observed time and evidence reference in existing payment records and pricing events. A timeout or an ordinary not found response is not proof of `no_session`; the adapter must establish definitive rejection or noncreation with no remaining in flight request. These facts are server produced, never a buyer or admin supplied claim.

After a definite `no_session` failure, retry the same order, quote and snapshot only while the quote is unexpired, the current item reference still matches, the claim belongs to the same buyer, and the confirmed terms remain applicable. Rate publication alone does not invalidate those terms. Acquire the initialization operation guard again before retrying; it excludes simultaneous retirement and another initialization attempt.

If that unpaid attempt has expired, its terms or eligibility changed, or its owner abandons it, call `retireUnpaidPricingAttempt`. Under the existing lock order, verify the latest attempt ID and revision, definitive `no_session`, no in flight initializer, no verified money, and that the item's current pointer still references this quote. Atomically cancel the unpaid order through the owning checkout lifecycle, set the quote to `retired_unpaid`, clear only that item's matching `active_price_quote_id`, increment `pricing_revision`, append the retirement receipt, and restore or expire only its matching claim using the existing failure rules without extending its clock. Preserve the old order, request result and immutable pricing snapshot. A repeated retirement returns the same result. A request with an old attempt revision cannot release a newer attempt. Replaying the original payment request still resolves only to the old order and snapshot. Its current payment status is `pricing_attempt_retired`, and any initialization retry returns 409 without reviving the attempt. A replacement needs a new quote and operation key.

A replacement can now obtain a new quote ID and order; the old unique quote to snapshot association remains intact. A new initial payment still requires normal claim ownership and quote acceptance. A locked quote with an unknown result or any existing payable session is ineligible for retirement, regardless of quote age. Reconcile it first. If an unexpected verified capture later contradicts the no session evidence, record a payment reconciliation hold against the old order; never discard the money or overwrite another buyer's claim. Feature 12 supplies the resulting financial resolution.

Once a provider session exists, rate changes, supplier changes, and quote expiry cannot change its amount. Retry the same session or reconcile it; never silently create a new one at a different price. A verified successful payment honours the locked amount. Existing claim conflicts still produce the fulfilment hold described in spec 0002 rather than discarding captured money or taking another giver's claim. Quote expiry and the 60 minute claim hold are different clocks.

If payment binding wins a race with withdrawal, the locked terms prevail. If withdrawal wins, initialization does not start. If an administrator learns of a change while an initialization outcome is unknown, record it for reconciliation without modifying the in flight amount. No pricing sweep may delete or cancel a provider session.

### Later delivery changes

Compare the supplied full address with the quoted coverage area before fulfilment. An address within that area uses the already agreed delivery charge. An address outside it produces `delivery_quote_required` in the sourcing fulfilment contract. Givtme can obtain the missing recipient details using spec 0002's restricted contact rules; the giver still does not see the street address.

An operator prepares a delivery revision against the paid quote. Its gift amount and original rate stay fixed; only the area and delivery charge change. Show the original delivery charge, any already settled delivery adjustments, the new delivery charge, revised total, and signed difference to the original buyer. The difference is the new delivery charge minus the cumulative settled delivery amount, including earlier paid amendments and completed refunds from feature 12's reconciliation records. This prevents a repeated address change from charging the same difference twice. If that settlement history is unavailable or an earlier adjustment is unresolved, another amendment cannot proceed. Record approval against that exact revision, settlement revision, and buyer. A changed revision requires fresh approval.

Approval alone moves no money and does not release fulfilment. Feature 12's amendment adapter must reconcile any additional payment, any credit requiring its refund contract, or a zero difference before releasing the hold. The original order price snapshot remains unchanged. An amendment never enters `lockQuoteForOrder` as a second initial purchase: that service rejects quotes with `parent_paid_quote_id` set. No background debit, substituted gift, or automatic extra charge is permitted. Declining or ignoring the proposal leaves the hold in place for the sourcing cancellation and refund process; this feature does not invent that process.

### API and service surface

New paths follow existing route and response conventions. Admin mutations require JSON validation, a same origin request, server admin authorization, and an `Idempotency-Key`. Apply idempotency within actor and operation scope, retain the request hash, and return 409 for reuse with a different request. Preview writes nothing; it calculates the complete proposed terms and issues a signed token.

Use a purpose specific preview token for `rate_publish`, `quote_confirm` and `delivery_revision`. A sample calculation token cannot authorize a mutation. The server resolves authoritative subject identity, current item and quote revisions, policy revision and rate version, normalized variant and quantity, source amount and evidence, check time and availability, delivery coverage and charge, reason, calculation version and every monetary output. Delivery previews also include the paid parent quote and settlement revision. The signed digest covers the normalized full proposal and calculated monetary outputs. IDs and commit timestamps generated only during confirmation are outside the digest. The quote's 24 hour validity starts at confirmation, independently of the preview token's ten minute validity.

Implementation recommendation: a versioned HMAC SHA-256 token using a new server only `PRICING_PREVIEW_SECRET` of at least 32 random bytes. Its signed payload contains the admin ID, fixed purpose, canonical proposal digest, issued time, expiry ten minutes later, and a random UUID nonce. Use a fixed schema, stable field ordering, decimal strings for exact amounts, and constant time signature comparison. No client selectable signing algorithm or secret is permitted. Changing any covered input requires a new preview; the UI clears its previous token on edit and disables confirmation until review completes.

On confirmation, first authenticate and resolve an existing idempotency receipt if present. A replay of the same completed request returns its original result even if the preview has since expired; changed content with that request key is 409. For a new mutation, verify signature, purpose, admin binding and expiry, then resolve and recalculate all authoritative terms under the transaction's revision checks. Compare the full digest, consume the nonce in the same transaction as the mutation, and record its receipt. An invalid or missing token is `preview_invalid`; an expired token, changed proposal or stale revision requires a fresh preview with 409. A token from another admin is refused. A consumed nonce cannot authorize another request key. A token grants no rights after the admin loses authorization. Tokens and signing secrets are not logged. Secret rotation invalidates unused previews, not quotes or payments.

| Surface | Inputs | Output | Authorization and errors |
| --- | --- | --- | --- |
| `GET /api/admin/pricing/policies` | Optional history cursor | Four policies, active versions, revision and paginated history | Existing admin helper; 401 or 403 |
| `POST /api/admin/pricing/preview` | Purpose (`sample`, `rate_publish`, `quote_confirm`, `delivery_revision`) and complete proposal fields of the matching mutation, including expected revisions | Exact internal breakdown, safe projection, covered proposal digest and purpose bound preview token with expiry | Admin; 400 invalid JSON, 409 stale context, 422 incomplete or invalid proposal |
| `POST /api/admin/pricing/policies/[key]/publish` | Proposed rate, reason, expected policy revision, matching preview token | Published version and new policy revision | Admin; 409 stale revision or reused key, 422 validation |
| `GET /api/admin/pricing/quotes` | Subject ID, cursor, optional status | Quotes and events for operator review | Admin; paginated, max 100 rows |
| `POST /api/admin/pricing/quotes` | Item reference, selected variant, checked NGN source amount, evidence, checked time, availability confirmation, delivery area and charge, reason, previewed rate version, expected item pricing revision, expected previous quote, matching preview token | Confirmed quote, its internal breakdown, expiry and safe display projection | Admin plus canonical subject validation; 404 absent subject, 409 changed context or active commitment, 422 incomplete inputs, 503 unconfigured policy |
| `POST /api/admin/pricing/quotes/[id]/withdraw` | Expected quote revision, reason; server resolves latest initialization evidence if locked | Withdrawn state, or `retired_unpaid` through the guarded retirement service | Admin; 404, 409 stale or locked without definitive no session evidence |
| `GET /api/wishlists/items/[itemId]/pricing` | Item ID only; server follows the item's explicit current quote reference | Safe current quote or estimate, selected variant and quantity, item pricing revision, quote state revision, expiry and payment availability | Existing wishlist access check; neutral 404 for unreadable item; no client price input |
| `POST /api/admin/pricing/quotes/[id]/delivery-revision` | New area and delivery charge, reason, expected paid quote identity and settlement revision, matching preview token | Delivery revision and difference from the paid quote | Admin; 409 unpaid source quote or conflicting revision; integration gated by feature 12 |
| `POST /api/orders/[id]/delivery-price-approval` | Delivery revision ID and expected revision | Recorded approval and current hold state, never a payment success | Existing order buyer only; 404 nonowned order, 409 stale revision; integration gated by feature 12 |
| `lockQuoteForOrder` internal service | Authenticated buyer context, resolved claim and subject, accepted current quote and state revision, item pricing revision, operation key | Order, immutable pricing snapshot, exact provider amount | Called only inside feature 12's authorized checkout transaction; stale, expired or mismatched inputs fail before provider call |
| `retireUnpaidPricingAttempt` internal service | Authorized order context, current initialization attempt ID and revision, definitive no session evidence, reason and operation key | Retired unpaid quote and order, released matching pointer, preserved snapshot and replay receipt | Server reconciliation, authorized buyer cancellation, or admin withdrawal invoking this guarded service; reject any session, captured money, in flight request, stale attempt or unknown outcome with 409 |
| `calculateCashTarget` internal service | Authorized manual cash subject and owner desired receipt, pinned rate version | Recipient amount, fee, target, versioned calculation | Feature 14 supplies mode; feature 6 owns commitment and funding. Not a public arbitrary money endpoint |
| `calculatePartialCashPayout` internal service | Eligible gift and closure operation, reconciled funds snapshot and ledger revision, pinned partial rate version | Verified receipts, refunds and reversals, net calculation base, deduction, receipt, required full allocation and calculation version | Features 6 and 17 prove eligibility; block insufficient unallocated balance or stale ledger; feature 15 freezes and reserves the reviewed calculation before transfer |

Do not add a source item to `/api/checkout` simply because it has a confirmed quote. Feature 12 must define its explicit checkout discriminator and adapter while retaining the catalog external rejection. These internal services specify pricing inputs and outputs without silently designing a second order or payment system.

The public pricing projection contains `state`, `currency: 'NGN'`, nullable `quote_id`, quote state revision, item pricing revision, selected variant label and quantity, expiry, `gift_price_ngn` or `recipient_ngn` plus `cash_fee_ngn`, nullable delivery when unknown, nullable total until complete, and a payment availability state. It contains no actor IDs, source cost, physical rate, supplier evidence, event history, or full delivery context. Quote identifiers confer no access. Owners receive intended receipt and policy deductions through their authorized flow, not a new signal that a giver has paid.

### Value sourcing

| Action or value | Authoritative source |
| --- | --- |
| Admin or buyer identity | Verified server session; admin membership through `getAdminApiUser`, buyer ownership through existing order checks |
| Path and gift identity | Stored candidate and wishlist association plus the canonical `PricingSubject` resolver supplied by features 12 and 14; never a submitted `origin` override |
| Estimate source cost | Native candidate source price, or existing NGN conversion with currency and conversion provenance; manual entered price remains indicative |
| Confirmed cost and availability | Operator confirmation inputs saved on the immutable quote; source reference and check timestamp required for physical gifts |
| Rate | Active policy version for a new estimate or quote; referenced historical version for an existing quote or commitment |
| Delivery charge and coverage | Operator entered whole Naira charge and normalized area snapshot on the quote; never the old environment buffer |
| Current quote, variant and quantity | `wishlist_items.active_price_quote_id` and `pricing_revision`, pointing to the quote's operator confirmed variant, quantity 1 and private delivery area. The same pointer and revisions are checked at acceptance |
| Quote expiry and revision | Database confirmation time plus 24 hours; quote lifecycle revision and separate item pricing revision |
| Confirmable preview | Server resolved complete proposal and exact calculation, canonical digest, verified admin ID, ten minute expiry and random nonce signed with `PRICING_PREVIEW_SECRET`; expected resource revisions are rechecked at mutation |
| Safe unpaid retirement | Latest server initialization attempt ID, revision and definitive no session evidence, no captured funds or in flight request, and the item's matching active quote pointer; retirement changes only lifecycle state and active references |
| Public and owner amounts | Named calculation above and role appropriate projection; display through `formatPrice()` |
| Payment amount and currency | `order_pricing_snapshots.total_ngn` and NGN, consistent with the order; callback amount verified against that snapshot and existing order |
| Cash target commitment | Desired receipt from the owner confirmed manual cash mode; rate snapshot pinned by the future funding adapter before collection starts |
| Partial payout base and rate | Feature 6 funds snapshot: verified receipts less completed refunds and reversals, its ledger revision and available unallocated balance; eligible closure and operation ID from feature 17; partial rate captured at owner review. Feature 15 reserves the full reviewed base once before transfer |
| Delivery amendment amount | Original paid quote's gift and delivery amounts, cumulative settled delivery adjustments and settlement revision from feature 12, new operator delivery charge, and the buyer's recorded approval of that exact quote and settlement revision |
| Audit history | Appended rate, quote and event records with server timestamps and opaque actor identifiers |

### Security, screens, and operation

Enable row level security on every new exposed table and grant no direct `anon` or `authenticated` access to raw pricing tables. Route handlers authorize the request before privileged reads or writes and expose only explicit projections. Prefer `SECURITY INVOKER` functions available only to the privileged server role for atomic pricing mutations. Revoke default `PUBLIC`, `anon`, and `authenticated` execution on those functions. Retain existing authenticated order functions and ownership policies; do not make them globally privileged to simplify integration.

Admin rights come from the existing `ADMIN_EMAILS` server configuration, not user editable metadata. Sanity editors acquire no pricing permission merely by editing catalog content. Signed out users can read a price only when the existing wishlist visibility rules permit it. Price visibility settings continue to control list presentation; a giver must see the amount they are explicitly approving on an authorized checkout surface. Raw calculation evidence remains admin only.

`/admin/pricing` uses the existing admin shell and form primitives. Show one section per policy with unset or active state, percentage, sample calculation preview, reason, Publish action, and history. A publish conflict keeps the draft and shows the newer version for review. A quote section links to existing candidate review, captures evidence and coverage, previews the final amount, and presents explicit Confirm, Replace, and Withdraw actions. No editable final total field remains on this path. Paginate history at 50 rows with a maximum of 100.

On a gift surface, distinguish `pricing_unavailable`, `estimate`, `confirmed`, `expired`, `withdrawn`, and an active payment continuation. Do not expose a locked state to the owner if it would reveal a hidden purchase. Existing public claim presentation remains owned by spec 0002. Keep an estimate visible during a failed refresh, labelled as such, but require a fresh server check before any payment. Announce price changes accessibly and require a clear review action. Quote expiry alone does not reserve or release an item.

Reuse the existing UI and `PriceDisplay`, form and button primitives. This feature adds no new design system, generated imagery, or public standalone page. Existing Museum and wishlist metadata must never advertise an estimate as a guaranteed purchasable offer; any price structured data must follow the availability state. Private prices and quote records are not indexed or cached publicly. Pricing responses and payment eligibility reads use `no-store`; begin without a new pricing cache or queue.

Record structured operation outcomes using quote, rate version, order, event and request IDs. Track missing policy refusals, stale quote conflicts, unknown payment initialization, delivery holds, and snapshot amount mismatches. Do not log source credentials, full addresses, card data, or raw provider payloads. Monitoring can use the existing deployment logs and admin history; no new observability service is required.

**Configuration**: reuse `ADMIN_EMAILS`, Supabase server credentials, and existing Flutterwave secrets. Add `GIFT_PRICING_V1_ENABLED`, default false, as a server rollout switch. Admin preview and policy setup remain available while payment integration is disabled. Add `PRICING_PREVIEW_SECRET` for signed previews; absence or invalid secret prevents confirmable previews and their mutations, without affecting existing quotes or payment reconciliation. Setting the switch false stops new versioned payment starts; it never stops verification, reconciliation, or fulfilment of existing commitments. Rates live in the database, not environment variables. The old `FETCH_MARKUP_PERCENT`, `FETCH_DELIVERY_BUFFER_NGN`, and `FETCH_ROUNDING_NGN` are retired from converted paths.

**Critical test scenarios**: [verify.md](verify.md) maps each acceptance criterion to executable evidence. Race tests use a real disposable Postgres database; mocked route tests alone cannot prove uniqueness or locking.

## Migration plan

**Strategy**: additive records and controlled migration of the existing estimate path, followed by quote based sourcing integration. No historical charge recalculation.

1. Add the five tables, nullable active quote reference and defaulted pricing revision on items, constraints, indexes and server only functions in the next free root migration `gifvtme_migration_NNN_configurable_gift_pricing.sql`. Scan the migration numbers at build time. Seed only policy keys. Inspect actual order schema and policies before attaching snapshots; their complete original definition is not in this repository.
2. Add preview and policy publication, with exact arithmetic and the linked item estimate path, behind the rollout switch. Preserve raw source evidence and old pricing fields for audit. Do not initialize policy rates from the 25 percent fallback or copied candidate fields.
3. Move candidate displays and admin editing to the new calculation. Remove fallback to `admin_price_ngn`, `recommended_price_ngn`, and the delivery buffer as authorities on migrated records. Recompute estimates from source amounts, never from a price that already includes markup. Previously promoted active catalog products need inventory classification through feature 12 before being treated as sourced; do not mass reprice catalog inventory.
4. Enable quote confirmation and safe public reads. New quotes require explicit confirmation; do not backfill old estimates as confirmed quotes or manufacture source check timestamps. Retain legacy fields until their readers are retired and evidence has been preserved.
5. Integrate with feature 12's accepted sourcing checkout and delivery amendment contract. Prove one real linked gift from published rate to displayed estimate, confirmed quote, verified payment, and order snapshot. Keep actual sourced payment disabled until the external versus catalog boundary and required product guidance are reconciled.
6. Add manual and cash adapters only when their mode, funding and payout prerequisites exist. Populate historical snapshots only from proven original records if needed; leave old orders on their existing route rather than inventing policy versions for them.

**Rollback**: disable new versioned payment starts, keep versioned records and reconciliation code, and continue existing payment callbacks. Do not drop the tables, alter a committed amount, restore guessed default pricing on a migrated payable offer, or reenable final price overrides. A frontend rollback must still understand existing quote based orders or keep those surfaces unavailable until repaired.

**Risks**: candidate estimates may already include markup; classifying them as raw source cost would charge it twice. Foreign source amounts can be mistaken for NGN if conversion fails. Existing order policies are not fully defined in the original migrations. Reverting payment readers before committed quote orders finish would strand their reconciliation. The migration and rollback checks must prove these cases before enabling payment starts.

## Build plan

The repository's Tracer Bullet approach starts with one linked gift through every available layer. Core pricing can be built before sourced checkout is enabled; the feature is not marked complete while required money flow integrations remain unverified.

1. Build the initial vertical path: additive pricing migration, exact calculator, admin preview and rate publication, one linked candidate estimate, and the public estimate state. Include unconfigured and explicitly zero rate handling, source precision, admin authorization, and no guessed delivery charge. Satisfies AC-1, AC-2, AC-3, AC-4, AC-15, AC-17, AC-18, AC-19.
2. Extend that same gift through operator confirmation, evidence capture, quote history, shared safe projection, 24 hour expiry, and explicit replacement for supplier changes. Add exact signed preview checks, the single current quote pointer and atomic revision checks; prove operator and public browser behavior. Satisfies AC-8, AC-9, AC-10, AC-11, AC-13, AC-15, AC-16, AC-17, AC-19.
3. Once feature 12 supplies its accepted checkout contract, connect quote acceptance to order creation and payment snapshot locking, provider initialization reconciliation, safe retirement of definitively unpaid attempts, retries and verified payment. Prove the external item cannot enter catalog checkout and rerun catalog pricing and order authorization regressions. Satisfies AC-7, AC-12, AC-16, AC-18, AC-19.
4. Extend the path to known delivery area, later address validation, held fulfilment, exact delivery revision approval, and feature 12's amendment reconciliation. Do not release fulfilment merely because the buyer approved a new figure. Satisfies AC-3, AC-13, AC-14, AC-16, AC-19.
5. Add the manual sourced adapter when feature 14 provides canonical mode. Add cash target and partial payout calculations and their owner projections, with the defined net receipts base, full balance reservation, and immutable commitments supplied by features 6, 15, and 17. Verify no fee stacking, no deduction from the promised full cash receipt, and no unsupported money controls exposed. Satisfies AC-2, AC-4, AC-5, AC-6, AC-11, AC-13, AC-15, AC-19.
6. Complete the remaining candidate migration, remove old authoritative price overrides and environment defaults, align README and environment guidance, document UI additions in `ui-registry.md`, and run the full acceptance matrix including rollout rollback. Satisfies AC-7, AC-15, AC-17, AC-18, AC-19.

## Consequences

**Benefits**: Operators can change rates without releases. Historical calculations remain explainable. Givers distinguish estimates from accepted totals, and cash recipients see the amount intended for them.

**Costs**: Operator confirmation is required before sourced payment. Price changes can interrupt checkout even within the 24 hour quote window. Givtme absorbs processing fees and supplier increases after payment starts. Retained quote history and reconciliation require operational attention.

**Boundaries**: A valid quote is not a stock reservation, funding ledger, procurement instruction, or custody agreement. Payment adapters must enforce their own eligibility and fulfilment contracts as well as this pricing contract. The catalog grace period remains an explicitly separate unresolved product question.

## Follow-up

* [ ] Feature 12 must reconcile sourced offers with spec 0002 AC-26, platform model AC-13, the product source of truth, and repository transaction guidance before sourced checkout is enabled. This spec does not edit or supersede them.
* [ ] Feature 12 must implement the source resolver, payment start adapter, delivery amendment settlement, cancellation and refund handling. A quote or recorded approval alone must not make those flows available.
* [ ] Feature 14 must provide the persistent cash versus sourcing mode and canonical manual gift identity before its pricing adapters are enabled.
* [ ] Feature 6 must settle custody and refunds, define the lifetime of a funding target after the first contribution, and reconcile whole Naira calculation inputs before collection. A 24 hour single purchase quote is not automatically a guarantee for a long running pool.
* [ ] Features 15 and 17 must persist accepted payout calculations, prove funds remain available, and reconcile transfers and closure eligibility. Rate configuration alone does not authorize a payout or a no refund policy.
* [ ] Record the `supabase` and `supabase-postgres-best-practices` skill pointers in the relevant durable database and API context when context maintenance is next performed. No AGENTS.md files are edited by this architecture task.

## Rationale

Reasoning, alternatives, confirmed choices, and implementation evidence: [rationale.md](rationale.md).
