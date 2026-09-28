# Configurable gift pricing: decision record

## Context

Scope feature 13 needs one configurable pricing policy across sourced gifts and cash calculations. It also needs to explain earlier prices after operators change the rates. You chose a separate spec linked to the existing checkout contract, rather than expanding or replacing spec 0002.

The current Museum estimate already applies a markup, adds a delivery buffer, and rounds upward. Candidate review can also set a final price directly. Those mechanisms do not provide the agreed quote evidence, rate history, 24 hour validity, or immutable payment amount. Copying their defaults into a new settings screen would preserve the wrong calculation.

The existing application separates external purchase marking from catalog checkout. Sourced checkout, cash modes, pooling, and payout settlement are adjacent features with unresolved contracts. This pricing design must give them precise monetary inputs and outputs without silently treating a published external item as catalog inventory, creating a wallet, or authorizing pooled fund custody. Price controls can be built first, but their dependent money flows cannot be declared complete with only a calculator.

## Options considered

### Option 1: Extend the existing candidate pricing fields

Make the current markup and delivery fields editable through the admin interface. This is the smallest code change and reuses the existing candidate queue. It leaves pricing attached to individual candidates, mixes estimates with override prices, and would still need separate history and payment snapshot machinery.

### Option 2: Add versioned policies and quotes alongside commerce

Use the existing database and admin application for preserved rate versions, confirmed quotes, and order price snapshots. Move each existing pricing reader onto the new contract in a controlled slice. This keeps catalog checkout intact and makes the source of every charge explicit, at the cost of additional records and careful payment reconciliation. This is the chosen option.

### Option 3: Replace catalog and sourcing prices with one new engine immediately

One new engine would eventually simplify the number of pricing entry points. It would also force decisions about catalog sales, inventory classification, source fulfilment, and payments into a feature whose agreed scope leaves catalog behavior intact. The migration risk is disproportionate to the benefit.

## Rationale

Your requirements distinguish a price estimate, an operator confirmed quote, and an amount accepted for payment. They have different lifetimes and cannot safely be represented by one mutable price field. Versioned policies establish which rule was used, quote history preserves the inputs, and an order snapshot establishes what payment was authorized to collect.

You chose to replace quotes when supplier prices change before payment, rather than make Givtme absorb those changes for the entire 24 hours. The quote lifetime therefore limits when payment can begin; it is not an unconditional stock or price guarantee. Once a payment session starts, the accepted amount stays fixed. That boundary avoids a delayed transfer being reinterpreted as an underpayment merely because a supplier or operator changed a price.

Your cash choice defines the entered amount as the recipient's intended receipt. Adding the platform fee makes that promise clear. A partial closure has a different business outcome and uses its own deduction against confirmed funds, without stacking the original gift or cash fee. A common calculation module helps enforce both rules without claiming that their collection and payout flows already exist.

Exact input arithmetic followed by explicit whole Naira rounding matches your display preference while retaining enough evidence to explain the result. Storing only the rounded source value would lose the calculation you actually approved. Existing catalog prices remain with their existing helper because an additional markup or new sale timing would violate the scope you chose.

## Confirmed choices

| Topic | Your choice |
| --- | --- |
| Spec placement | Separate pricing spec linked to the existing checkout contract |
| Payment eligibility | Estimate first, then Givtme confirmation before sourced payment |
| Policy shape | One configurable percentage per path, no launch category or price band engine |
| Cash amount | Owner enters desired receipt; fee is added to the target |
| Physical markup base | Confirmed item price only |
| Delivery | Separately quoted charge |
| Payment processing | Absorbed by Givtme |
| Launch rates | Operators publish them before the corresponding money path is enabled |
| Partial closure | Separate percentage against verified receipts less completed refunds and reversals; no processing or sourcing deduction from that base |
| Quote lifetime | 24 hours before starting a new payment |
| Rounding | Whole Naira; model confirmation accepted nearest Naira with halves rounded up |
| Supplier increase before payment | Withdraw and replace, requiring giver approval |
| Supplier decrease before payment | Replace at the lower price, requiring review |
| Catalog sale timing | Unchanged in this feature, including current grace behavior |
| Payment already started | Lock the amount and honour it if payment succeeds |
| Rate changes | Affect new quotes, preserve existing quotes and commitments |
| History | Preserve every published rate version and confirmed quote, including expired and withdrawn quotes |
| Operator correction | Correct source and delivery inputs, then calculate; no custom final price override |
| Quote audience | Shared among eligible givers for the same gift, variant and delivery destination context |
| Source evidence | Source reference and time of price check required |
| Data model | Policies, rate versions, confirmed quotes, one payment price snapshot per order, and pricing events; reviewed fix adds a current quote reference and pricing revision to the item |
| Admin surface | Existing admin area with calculation previews |
| Publication | Authorized admin publishes immediately with actor, time and reason recorded |
| Physical price display | Gift price, delivery and total; no supplier cost or physical markup breakdown |
| Cash display | Recipient amount, platform fee and total |
| Missing full address | Known delivery area plus operator confirmed charge is enough for a quote |
| Later address outside area | Hold fulfilment, revise delivery charge, obtain approval, no automatic extra charge |
| Partial fee stacking | Only the separate partial payout deduction applies |
| References | No separate References section; retain the reasoning |

## Engineering recommendations

These choices complete the implementation contract and remain reviewable with the draft. They are not represented as separate earlier business approvals.

| Recommendation | Reason and closest alternative |
| --- | --- |
| Supabase transaction records and existing admin access | Reuses current operations and authorization. Sanity rate controls were the alternative; you selected the admin area. |
| Integer basis points and exact monetary arithmetic | Reproducible percentage calculations. Decimal percentages with the same precision are possible but require more normalization. |
| Preserve source cost, round the resulting gift price | Avoids an extra rounding operation before markup. Rounding source cost first would change the agreed price for some inputs. |
| Existing 500 percent markup ceiling; partial deduction below 100 percent | Retains the present administrative guard for markup and prevents a deduction exceeding funds. Tighter commercial ceilings can replace this guard later without choosing launch rates here. |
| Explicit source check timestamp within the preceding 24 hours | Connects confirmation to recent evidence. Treating old scrape results as confirmation would undermine the quote boundary. |
| Server only pricing tables and narrow public projections | Raw quote records contain commercially sensitive costs and private context. Direct client table access would need more complex policies and risks leaking fields. |
| Expected revisions, database locks and request keys | Stops conflicting admin edits and duplicate payment binding. Application checks alone cannot settle a race. |
| No new price cache or background price checker | Existing volumes do not establish a need. A cache would require invalidation rules around publication and withdrawal before being safe. |
| Keep complete monetary history and detachable identity references | Retains price explanations without making an item impossible to delete. Destructive history cleanup is a different retention decision. |
| Reuse existing UI primitives and provider services | Keeps this feature focused on pricing. New styling, payment, or observability infrastructure adds no needed capability. |

## Independent review and approved resolutions

A different model reviewed the complete build spec and rationale. Its verification checklist read stalled, so it did not independently review that file. The author had already read the checklist and checked acceptance criterion coverage. The reviewer found no separate gap in preserved rate versions or paid quote amounts and correctly treated the sourcing, ledger and settlement dependencies as explicit release gates.

You approved all four recommended corrections in the design conversation. They are applied to the build contract and verification scenarios:

| Finding | Approved resolution |
| --- | --- |
| A definitively failed initialization could leave the item permanently locked | Retain a retryable valid attempt on the same order. When a definitively unpaid attempt is stale or abandoned, an atomic `retired_unpaid` transition cancels it, clears only its matching active item reference, and preserves the historical snapshot. Unknown results and existing sessions cannot use this release. |
| Item ID alone could not select among several variant or area quotes | Each item has one explicit current quote and pricing revision. That quote identifies its confirmed variant, quantity and delivery area. Reads and acceptance use the same reference; changes require replacement. |
| Confirmed receipts and available payout balance were ambiguous | Define the fee base as verified receipts less completed refunds and reversals. Processing and sourcing costs do not shrink it. Reserve the complete reviewed base once and block if the unallocated gift balance is insufficient. |
| Confirmation did not prove the exact terms had been previewed | Bind each mutation to a server issued, purpose specific signed preview of every relevant input, revision and output. Editing terms requires another preview; confirmation checks and consumes it atomically. |

The HMAC token format, ten minute preview lifetime, protected item columns, and precise state transition mechanics are implementation details chosen to carry out those approved fixes. They do not change the 24 hour quote lifetime or permit additional charges. The checklist contains regression scenarios for each resolution. Applying these fixes is not a claim that an independent second pass or implementation tests have passed.

## Implementation evidence

Inspected locally on 2026-09-25. These observations describe the checkout and pricing code at design time, not proof of deployed behavior.

| Area | Observed behavior and implication |
| --- | --- |
| `lib/gift-museum/pricing.ts` | `FETCH_MARKUP_PERCENT` defaults to 25, `FETCH_DELIVERY_BUFFER_NGN` to 5000, and `FETCH_ROUNDING_NGN` to 500. It rounds upward after markup and buffer. Replace this authority for migrated sourced estimates. |
| `gifvtme_migration_028_gift_museum_candidates.sql` | Stores source cost, conversion provenance, candidate markup, delivery buffer, rounding, recommended price and admin price. These are useful migration evidence but are not versioned policies or confirmed quotes. |
| `lib/gift-museum/candidates.ts` | Public card pricing prefers admin price, then recommendation, then converted price. It must not fall through to legacy values when a new policy is missing. Candidate publication and inventory eligibility remain separate. |
| `lib/gift-museum/admin.ts` | Allows a final admin price and candidate markup through 500 percent. Candidate promotion creates a Sanity product draft. A draft is not proof of stocked catalog eligibility. |
| `lib/gift-museum/fx.ts` | Returns rounded NGN conversion values and can return no conversion. A failed conversion must not cause a raw foreign source amount to be presented as Naira. Native source precision is available separately. |
| `lib/flutterwave/getActivePrice.ts` and its tests | Handle catalog base and variant prices, sale clamping, and the five minute grace window. Reuse and preserve these rules. |
| `app/api/checkout/route.ts` | Calculates prices on the server, persists changed display prices, creates order rows through an atomic database function, and initializes Flutterwave after persistence. Pricing integration must preserve its ownership and retry controls. |
| `gifvtme_migration_027_gift_order_transactions.sql` | Supplies gift order transaction machinery. The new pricing adapter must participate in the money transaction instead of updating snapshots afterward. |
| `lib/admin/auth.ts` | Existing verified session plus `ADMIN_EMAILS` gate supports pricing administration. The current page guard has a fixed return destination, which should accept the pricing page's return path when reused. |
| `lib/wishlist/validation.ts` | Catalog and external are the transaction discriminator. Manual cash versus sourcing mode is not present, so the pricing feature cannot infer it from current external capture. |
| `lib/utils.ts` | `formatPrice()` displays whole Naira. New payable amounts must already be rounded correctly before reaching it. Formatting is not payment calculation. |
| Existing order schema | Older migrations describe an originally live created orders table. Inspect its actual constraints and policies before an additive order snapshot migration. |

The working tree already contained unrelated changes to context files, scope, an occasion component, and deleted local skills. This architecture task does not overwrite them. No production data, migrations, application code, or external messages are changed by writing this spec.
