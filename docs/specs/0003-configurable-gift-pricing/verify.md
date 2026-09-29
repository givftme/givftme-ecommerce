# Configurable gift pricing: acceptance verification

The build contract is [index.md](index.md). This file describes evidence to collect during implementation; none of the scenarios below is reported as passed by writing the spec.

## Setup and prerequisites

Use a disposable database, test users, and Flutterwave test configuration. Include an admin, another admin, a wishlist owner, two eligible givers, an unrelated signed in user, and a signed out browser. Prepare a linked candidate, a manual sourced subject, a manual cash subject, a catalog product with a variant and sale, and a private wishlist. Rates in fixtures are not approved production rates.

The sourced payment scenarios require feature 12's accepted resolver and checkout adapter. Manual mode requires feature 14. Real contribution and payout verification requires features 6, 15 and 17, including their custody and refund gates. Keep those scenarios marked blocked until their actual integrations exist; a mock or calculator result is not release evidence for moving money.

## Calculation evidence

| Scenario | Expected result | Criteria |
| --- | --- | --- |
| Physical base | Source 10,000, rate 10%, delivery 1,500 gives gift 11,000 and total 12,500. No markup on delivery and no processing surcharge | AC-3, AC-4 |
| Fractional source | Source 100.50 at 10% gives unrounded gift 110.55 and rounded gift 111. Audit reconstructs the original input | AC-4, AC-15 |
| Half boundary | Source 101 at 50% gives 151.50 and rounds to 152. Adjacent values below and above the half behave correctly | AC-4 |
| Zero published rate | A configured zero rate works and differs from an absent active version | AC-2 |
| Cash | Desired receipt 10,000 at 10% gives fee 1,000 and target 11,000. Processing fees never reduce the promised 10,000 | AC-3, AC-5 |
| Partial closure | Verified receipts 7,000 less completed refunds 800 and reversals 200 gives a base of 6,000. At 5%, deduction is 300 and receipt is 5,700. Do not deduct original cash or source markup again | AC-6 |
| Partial balance shortfall | For that 6,000 base, available unallocated funds of 5,999 blocks the whole resolution even though the recipient figure is 5,700. Do not shrink the base by sourcing, processing, prior payouts or allocated costs | AC-6, AC-19 |
| Partial allocation race | With sufficient funds, race two closure allocations, then change the ledger revision between review and execution. One allocation succeeds; replay resolves it; stale review requires recalculation and owner approval | AC-6, AC-16, AC-19 |
| Small values | A fee can round to zero without adding a minimum. Zero net payout creates no provider transfer. Invalid zero physical totals are rejected | AC-2, AC-4, AC-6 |
| Limits | Reject negatives, nonfinite values, excess decimal precision, out of range rates and overflow. A delivery charge of zero must be explicit | AC-4, AC-17 |
| Foreign source unavailable | Failed NGN conversion shows pricing unavailable. A foreign amount is never interpreted as Naira | AC-8, AC-17, AC-18 |
| Cash funding inputs | Pending, reversed, refunded, allocated or unrelated funds cannot be treated as available confirmed funds. Fractional inputs cannot be silently truncated | AC-6, AC-19 |
| Catalog | Existing base, variant, sale, sale clamping and five minute grace results stay unchanged; new rates add no markup | AC-7 |

Run the pure calculation suite with the same fixtures against the authoritative database calculation where one is used. Assert exact equality rather than a tolerance that could hide a monetary difference.

## Operator and quote evidence

| Scenario | Expected result | Criteria |
| --- | --- | --- |
| First configuration | Fresh migration contains four policy keys and no launch rates. Admin publishes each desired rate explicitly | AC-1, AC-2 |
| Preview then publish | Admin changes a rate, sees the full sample breakdown, supplies a reason and publishes. History shows actor, time and old and new version. No second approver is required | AC-1, AC-15 |
| Concurrent publication | Two admins preview the same revision. One publishes; the other receives 409 and retains their draft without overwriting the winner | AC-1, AC-16 |
| Publish retry | Replay an operation key with the same body, including after preview expiry, then a different body. The original completed request resolves to the same publication; different content is rejected | AC-16 |
| Exact preview | After preview, change cost, variant, quantity, source evidence, delivery area or charge, reason, rate, or calculation output. Confirmation rejects every mismatch until a matching new preview is reviewed | AC-1, AC-8, AC-15, AC-16 |
| Preview authenticity | Try a forged signature, a sample token used for confirmation, another admin's token, an expired token, a missing secret, and a consumed nonce with a new request key. None creates a mutation; replay of an already completed original operation still resolves | AC-1, AC-16, AC-19 |
| Preview resource race | Change the policy, item selection or current quote after preview. Even an unchanged client body and valid signature cannot confirm against stale authoritative revisions | AC-9, AC-16, AC-19 |
| No final override | Attempt to submit a custom total, old candidate admin price, or delivery buffer. Only validated inputs and the referenced policy produce the confirmed total | AC-3, AC-15, AC-18 |
| Estimate display | Linked or manual source amount yields a labelled estimate. Unknown delivery is not displayed as free and no payment action is enabled | AC-8, AC-17 |
| Incomplete confirmation | Missing availability, variant identity, evidence, check timestamp, rate, or delivery area prevents confirmation. A fabricated old evidence timestamp is not backfilled | AC-8, AC-17 |
| Known area | Confirm a quote with area and delivery charge but no full address. It has a 24 hour expiry and contains no invented destination record | AC-9, AC-14 |
| Shared quote | Create historical quotes for multiple variants and areas, then set one current quote. Two eligible givers receive exactly that quote's selected variant, quantity and permitted pricing projection. The endpoint never guesses from history or creates a claim | AC-9, AC-19 |
| Current quote replacement | Confirm another variant or area against the expected item revision. Withdrawal and pointer replacement are atomic; another concurrent confirmation conflicts. Acceptance of the old quote or item revision fails before any payment request | AC-9, AC-10, AC-16, AC-19 |
| Current quote integrity | Attempt a cross item quote pointer, a delivery amendment as the initial pointer, an arbitrary client selected historical quote, and replacement while a payment binding is active. Reject each without altering the original context | AC-9, AC-16, AC-19 |
| Context mismatch | Change selected variant, quantity, canonical fulfilment mode, or delivery area. The old quote cannot initialize payment against the new context | AC-9, AC-16, AC-19 |
| Expiry | Just before expiry a fresh payment may start. At expiry and afterward it may not, even if no cleanup job ran | AC-9, AC-12 |
| Supplier increase | Withdraw and replace an unpaid quote at a higher checked cost. An old browser tab is stopped; the giver must review the replacement | AC-10 |
| Supplier decrease | Repeat with a lower checked cost. The replacement uses the lower calculation and still requires explicit review | AC-10 |
| Policy change | Publish a new rate. New estimates and quotes use it; the existing valid quote and old history still use their referenced versions | AC-11, AC-15 |
| History and deletion | Expire, withdraw and replace quotes; delete a permitted item or user. Monetary evidence remains, detached quotes cannot be newly used, and retained audit data does not expose the deleted person's private details | AC-15, AC-19 |

## Payment and delivery evidence

| Scenario | Expected result | Criteria |
| --- | --- | --- |
| One real linked gift | Published rate to visible estimate, confirmed quote, authenticated acceptance, provider initialization, verified payment and readable buyer order. Order, quote snapshot and provider amount agree | AC-8, AC-12, AC-18, AC-19 |
| Withdrawal race | Run quote withdrawal against payment binding concurrently in Postgres. Either withdrawal wins and no session starts, or binding wins and locked terms prevail | AC-12, AC-16 |
| Two buyers | Race payment initiation from eligible givers. Only the valid claim holder can bind and at most one active purchase session exists for the gift | AC-9, AC-12, AC-16, AC-19 |
| Tampered amounts | Submit a different total, rate, origin, item association, or quote belonging to another context. The server rejects it or ignores display only data; no forged amount reaches the provider | AC-12, AC-19 |
| Lost initialization response | Let the provider accept initialization and lose the response. A retry reconciles that session rather than opening a second one | AC-12, AC-16 |
| Definite initialization failure | Provider proves no session exists. A valid retry uses the same order, quote and snapshot. Expired or changed terms instead trigger the atomic unpaid retirement and require a new quote before another request | AC-9, AC-10, AC-16 |
| Retirement persistence | Retire a definitively unpaid attempt through server reconciliation, authorized buyer cancellation, and admin withdrawal. Its order, quote and snapshot remain historical; the quote is `retired_unpaid`, only the matching item pointer clears, and its pricing revision advances. A replacement creates new IDs without violating historical uniqueness | AC-12, AC-15, AC-16 |
| Retirement race | Race retirement against retry and a newer initialization attempt. The attempt guard and revision allow only one action. An old attempt's failure cannot retire a newer in flight or accepted session | AC-12, AC-16 |
| Unsafe retirement | Timeout, ordinary provider lookup absence, unknown outcome, verified money, an existing session, or mismatched item pointer prevents retirement. No age based sweep releases the binding | AC-12, AC-16, AC-19 |
| Retirement replay | Repeat retirement and the original payment request. Retirement returns its original result; the old payment request resolves only to the retired order, and initialization returns 409 `pricing_attempt_retired`. It cannot resurrect the cancelled attempt or charge a replacement quote | AC-12, AC-15, AC-16 |
| Delayed success | Start within validity, then expire the quote, change the rate and raise supplier cost. Delayed verified payment still confirms the original amount | AC-11, AC-12 |
| Claim expired | A captured payment arriving after claim expiry preserves the payment and enters the existing claim conflict hold without taking another buyer's claim | AC-12, AC-19 |
| Webhook replay and mismatch | Replay success and send wrong amount or currency. A valid replay duplicates neither charge nor fulfilment. A mismatch cannot confirm the order | AC-12, AC-16, AC-19 |
| Catalog boundary | Try submitting an external quote or delivery amendment as an ordinary catalog cart entry. Catalog checkout still rejects the external path | AC-7, AC-18, AC-19 |
| Address within area | Later address matches the quoted coverage. Delivery uses the accepted charge without exposing the full address to the giver | AC-14, AC-19 |
| Address outside area | Fulfilment is held. Operator creates a delivery revision and buyer sees original charge, new charge and difference. Approval alone does not charge or release the hold | AC-14 |
| Amendment identity | Another buyer cannot approve; an old approval cannot approve a changed revision; an initial purchase endpoint cannot charge the full revised total as a second gift | AC-14, AC-16, AC-19 |
| Amendment settlement | Feature 12 reconciles the exact authorized difference before fulfilment resumes. Retry and repeated address changes cannot charge the same difference twice | AC-14, AC-16 |
| Cash and partial payout | Once owning features exist, actual funding and payout records preserve the reviewed policy and reconcile provider success once. A calculation alone does not satisfy this scenario | AC-5, AC-6, AC-11, AC-15, AC-19 |

## Access and interface evidence

| Scenario | Expected result | Criteria |
| --- | --- | --- |
| Unauthorized operator | Signed out and ordinary users cannot preview internal costs, publish rates, confirm or withdraw quotes, or inspect pricing history | AC-1, AC-19 |
| Direct database access | `anon` and `authenticated` cannot select or mutate raw pricing tables or call privileged mutation functions. Existing order policies are unchanged | AC-19 |
| Physical projection | Browser responses show selling price, delivery and total but no source amount, physical markup, evidence, audit actor, or full address | AC-13, AC-19 |
| Cash projection | Browser shows intended recipient amount, cash fee and total. Owner deductions use only the permitted cash or closure surface | AC-5, AC-6, AC-13 |
| Surprise and visibility | A private or archived item cannot obtain a new payable projection. Pricing history and locked state do not reveal a hidden giver action to the owner | AC-9, AC-13, AC-19 |
| Mobile and keyboard | Complete preview, publication, quote confirmation and changed price review at narrow width and using keyboard only. Labels, errors and announcements remain associated and readable | AC-17 |
| Network failure | Failed preview, read or publish does not imply success. Retrying a publish resolves its original result. Stale estimate display cannot authorize payment | AC-16, AC-17 |
| Metadata | Museum and wishlist previews never claim a pending estimate is an available buyable offer. Private prices and quote history do not enter public metadata or caches | AC-8, AC-13, AC-19 |
| Rollout and rollback | Unset policies stay unavailable. Switch off new starts after a test commitment; existing callbacks, reconciliation and historical order reads continue | AC-2, AC-12, AC-18 |
| Legacy migration | Changed candidate readers use raw source input and new rate, not an already marked up recommendation. Historical orders and curated catalog prices retain their original values | AC-7, AC-15, AC-18 |

## Review correction coverage

The independent review read the build spec and rationale but could not complete its checklist read. The four fixes it recommended were approved and are represented above by partial balance and allocation scenarios, exact preview scenarios, current quote selection scenarios, and retirement scenarios. These are implementation checks to run, not reported implementation results.

## Completion evidence

Record calculation results, migration dry run counts, constraint and policy inspection, database race outcomes, provider test transaction IDs, and browser evidence. Retain a list of blocked integration criteria and their owning features. Do not mark feature 13 done because the admin screen works while sourced payment, promised receipts, or delivery revisions remain unverified.

During implementation, use focused Vitest domain and route suites, real database constraint and concurrency tests, and browser verification of the admin and customer paths. Run the repository's type, lint, and build checks appropriate to the implemented changes. This architecture task itself changes documentation only.
