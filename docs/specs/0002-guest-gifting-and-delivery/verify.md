# Verification plan

Revised 2026-09-18 alongside the spec. Every scenario about anonymous sessions, guest order tokens and emailed access links is removed, because that decision is superseded. The continuation, tampering, replay and account switching scenarios replace them.

These are checks for implementation. None is marked passed by writing this spec. Use the repository's Vitest, type check, lint and build commands where relevant, plus real browser journeys and an isolated database with row policies enabled. This feature is GA in the scope, and it touches money and another person's home address, so mocked handlers alone are not sufficient evidence for anything in the privacy, policy, continuation or payment rows.

## The authentication boundary

| Scenario | Evidence and expected result | Criteria |
| --- | --- | --- |
| Public browsing | A browser with no session and no cookies opens a shared wishlist and every item page on it. Everything renders, nothing prompts for an account, and no intent or claim row is created | AC-1 |
| Gate on buy | The same browser clicks Buy this gift. It is prompted to sign up or sign in, and exactly one `gift_purchase_intents` row exists in `pending` | AC-1, AC-2 |
| Gate on reserve | The same browser clicks "I plan to buy this". Same prompt, same single intent, `intended_action = 'reserve'`, and **no claim exists yet** | AC-1, AC-2, AC-12 |
| Already signed in | An authenticated visitor clicks each action. No prompt appears, no intent row is created, and the reservation or the checkout happens immediately | AC-3 |
| Landing accuracy | After signup from Buy, the browser lands on gift checkout for that exact wishlist, item, product and variant. Assert the landing URL is never the homepage, `/wishlists`, `/account` or the wishlist root | AC-4 |

## The continuation, and its abuse cases

| Scenario | Evidence and expected result | Criteria |
| --- | --- | --- |
| Nothing in the client | Inspect the cookie, `localStorage`, `sessionStorage` and every request body across the whole journey. The only purchase related value the client holds is the opaque reference. No wishlist id, item id, product id, variant or price is client held or client supplied and then trusted | AC-5, AC-38 |
| Cookie attributes | The continuation cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, with a 24 hour `Max-Age`. Confirm `Lax` specifically, since `Strict` would drop it on the email confirmation return | AC-5, AC-8 |
| Tamper | Edit the cookie value, replace it with another intent's reference, present a random value, and remove it entirely. All four create nothing and none reveals whether a given reference exists | AC-5, AC-11 |
| No trusted facts stored | Inspect a `gift_purchase_intents` row. It contains no price, no product title, no image and no recipient data. Confirm resume re-resolves product, variant, availability and price from Sanity on every resume | AC-6, AC-7 |
| Price moved during signup | Change the catalogue price while the visitor is signing up. The resumed checkout shows and charges the new server price, not anything captured earlier | AC-7, AC-33 |
| Different tab | Start in one tab, complete signup in a second, resume in the second. The journey continues correctly | AC-8 |
| Browser restart | Close the browser entirely after creating the intent, reopen, complete sign in. The journey continues | AC-8 |
| Email confirmation, same device | Sign up with email confirmation and click the link in the same browser. Lands on the right gift checkout | AC-8 |
| Email confirmation, another device | Click the confirmation link on a phone that has never seen the cookie. The `?c=` path resumes correctly, and the link is confirmed to carry no wishlist or product context, only the opaque reference | AC-8 |
| Expiry | Resume an intent older than 24 hours. Nothing is created, and the visitor sees "Your purchase session expired. The gift is still here if you'd like to continue." on the original wishlist item | AC-9 |
| Expiry when the item is gone | Same, but the item has since been deleted. The visitor gets a sensible destination rather than an error page | AC-9 |
| Account switch | Bind an intent to account A, then present it while signed in as account B. Automatic continuation stops, nothing is created, no claim moves, and the visitor is asked to restart or review | AC-10 |
| Replay | Resume the same consumed intent three times, including concurrently. Exactly one claim exists, and every resume lands on the same next step rather than erroring | AC-11 |
| Ambiguous retry | Kill the connection mid resume, then retry. One claim, one intent consumed, and the retry resolves to the original operation | AC-11 |
| No hold before auth | With an intent pending, a second visitor reserves the same item successfully. Confirm the pending intent never blocked them | AC-12 |
| Taken during signup | A second visitor reserves the item while the first is signing up. The first is told it was just picked and offered the wishlist or another gift. The second's reservation is untouched and is never overridden | AC-13 |
| Purchased during signup | The item is bought while the first visitor signs up. They are shown it is no longer available | AC-13 |
| Cleanup | Run the sweep. Expired intents move to `expired`, and consumed, expired and cancelled intents past retention are deleted. Confirm no intent row is ever treated as a purchase record | AC-14 |
| Intent flood | Exceed the per IP intent creation limit and receive 429. Confirm intent creation still blocks no item | AC-14 |

## Reservations

| Scenario | Evidence and expected result | Criteria |
| --- | --- | --- |
| Reservation race | Two concurrent authenticated requests reserve the same item. Exactly one `wishlist_gift_claims` row exists, the loser receives 409, and the partial unique index is what rejected it. Run under load, not as a single pair | AC-15 |
| Clock start | Confirm `reserved_at` is set when the authenticated reservation is created, not when the intent was created. A visitor who took an hour to sign up still gets a full 72 hours | AC-16 |
| Hold clocks | A `reserved` claim expires at 72 hours and not before. Opening gift checkout shortens it to 60 minutes. Verify expiry is evaluated in SQL by querying directly with the application stopped | AC-16 |
| Hold renewal | Reload gift checkout repeatedly over more than 60 minutes. The hold does not move and the sweep releases on schedule | AC-16 |
| Release | The claimant releases their own reservation successfully. Another authenticated user attempting to release it is refused | AC-17 |
| Abandon and retry | Abandon checkout, then return. The claim is back in `reserved` on its original `reserved_at + 72h`, not a fresh 72 hours. Retry reuses the same order | AC-18 |
| Payment failure | Flutterwave reports a failed charge. Order becomes `payment_failed`, claim returns to `reserved`, and a retry succeeds with no second order | AC-18, AC-31 |
| Transaction boundary | Webhook arrives with a mismatched amount, then a mismatched currency, then unsigned. In all three the order stays `pending_payment` and the claim stays `checking_out`. No browser reachable path moves a claim to `purchased` | AC-19 |
| Visitor view | A second visitor, signed out, sees the reserved item as reserved and still openable, and a paid item as taken and not buyable. No response or rendered page contains any claimant id, name or email | AC-20 |
| Owner blindness | The owner loads their wishlist, item pages, dashboard and any data call while a claim and a paid order exist. Nothing appears. Query `wishlist_gift_claims` as the owner through row level security and confirm zero rows. Confirm no notification was queued | AC-21 |

## Gift checkout, privacy and fulfilment

| Scenario | Evidence and expected result | Criteria |
| --- | --- | --- |
| Address privacy | Capture every response on the gift checkout and gift order surfaces and assert none contains recipient `street_address`, `apartment`, `phone` or `delivery_instructions`. Attempt a direct select on `wishlist_delivery_destinations` as a non owner; denied by policy | AC-22 |
| Snapshot immutability | Complete a gift order, then change the owner's destination. The paid order's snapshot and the address fulfilment reads are unchanged | AC-23 |
| Missing destination | Buy from a wishlist with no destination. Payment completes, the order carries `needs_recipient_address`, no address is invented, and the buyer sees an honest message | AC-25 |
| External origin guard | Post an `external` origin item to gift checkout and receive 400. Confirm the affiliate redirect and `POST /api/purchases` still work unchanged for that item | AC-26 |
| Gift cart shape | Post a gift checkout with two cart entries, then one with quantity 2, then one whose entry does not match the claimed item. All three refused with 400 and no order row created | AC-27 |
| Delivery window | Windows offered match the recipient's state. Submitting a window that was not offered, or one in the past, is rejected on the server. The stored window matches what the buyer saw | AC-28 |
| Mid flight owner change | With one claim `reserved` and one item already paid for, the owner archives an item, deletes another, and switches the wishlist to private. Unpaid claims release with a neutral message that does not disclose the owner's settings. The paid order proceeds untouched | AC-29 |
| Neutral owner contact | Trigger the `needs_recipient_address` path. The message names no giver, item or price, and a `recipient_contact_events` row records it. Confirm no other path can message the owner about a claim or purchase | AC-30 |

## Integrity, and what must not regress

| Scenario | Evidence and expected result | Criteria |
| --- | --- | --- |
| Idempotency | Post the same `Idempotency-Key` twice, then concurrently. One order, one payment session, identical response. Confirm the `(buyer_id, idempotency_key)` index enforced it | AC-31 |
| Order policy diff | Dump the `orders` and `order_status_history` policy set before and after the change and diff them. **They must be identical.** An authenticated user requesting another user's order is refused through the API and through a direct query | AC-32 |
| Association cannot be nominated | Attempt to submit `wishlist_item_id` in the checkout body and confirm it is ignored. Attempt the old `localStorage` exploit, pointing at another readable person's wishlist item while buying the same product, and confirm that item is **not** marked purchased | AC-33, AC-38 |
| Server pricing | Submit a manipulated `display_price` and a stale price. The charged amount comes from `getActivePrice`, the warning persists in `price_changes`, and every displayed amount is Naira through `formatPrice` | AC-33 |
| Slow payment race | Force the claim to expire and let a second visitor reserve the item while a bank transfer settles. The first order confirms and carries `claim_conflict`, the second visitor's claim is untouched, nobody is charged twice. Run against a real delayed payment method | AC-34 |
| Cancelled and refunded | Cancel a `confirmed` gift order and refund a `delivered` one. Both claims release with `order_cancelled` and both items return to available. No item is left showing as taken with no gift coming | AC-35 |
| Webhook replay | Deliver the same successful webhook three times, and once after the order is already `confirmed`. Exactly one order, one confirmation email, one contact event | AC-31, AC-36 |
| Flag migration | Seed an `intent_flagged_at` 2 hours old and one 30 hours old, then run migration C. The first becomes a `reserved` claim, the second does not. Seed two live flags on one item and confirm the backfill takes the most recent without violating the unique index | AC-37 |
| Dead code gone | Confirm `lib/checkout/pendingWishlistItem.ts` no longer exists and has no remaining importers | AC-38 |

## Prerequisite checks before slice 1 ships

| Check | Expected result |
| --- | --- |
| Live `orders` row level security policies | Read from the live database and checked into the repository, so AC-32's promise that nothing widened can actually be verified rather than asserted |
| Steps 10 and 11 ship together | Deleting `pendingWishlistItem` without deriving the association from the claim breaks existing wishlist association; shipping step 10 without step 11 leaves the exploitable path live. Confirm they are one deployment |

The anonymous sign in, `handle_new_user` and invite backfill trigger checks from the superseded revision are removed. Ordinary signup already exercises those paths in production.

## Release evidence

| Item | Evidence |
| --- | --- |
| Shared wishlist performance | The public page still meets its 3 second budget on throttled 3G on a midrange Android device after the claims join lands on `wishlist_items_with_status` |
| Mobile and keyboard | The full journey, wishlist to signup to confirmation, works on a phone and by keyboard alone, including the email confirmation return |
| Conversion cost | The drop off between intent created and intent consumed is instrumented and reported. It is the measured cost of requiring an account and the number that would justify revisiting this decision |
| Payment reconciliation | Flutterwave test transactions reconcile one to one with confirmed orders, with no duplicates from webhook retries |
| Privacy review | A reviewer who did not write the code confirms the projection boundary, the owner blindness rows and the order policy diff, since the scope marks this feature GA |

## Migration gate

_Added 2026-09-18 by `/develop` after building slice 1. Nothing below this line has been run._

Slice 1's application code is written and green, but its SQL has not been applied to any database. Run this section first: every other check in this file depends on it, and until it passes, the gifting journey does not work at all.

| Step | Expected |
| --- | --- |
| Apply `gifvtme_migration_026_gift_claims_and_intents.sql` | Succeeds in one transaction |
| Apply `gifvtme_migration_027_gift_order_transactions.sql` | Succeeds in one transaction |
| `select to_regclass('public.wishlist_gift_claims'), to_regclass('public.gift_purchase_intents');` | Both non null |
| `select indexname from pg_indexes where tablename = 'wishlist_gift_claims';` | Includes `gifvtme_wishlist_gift_claims_one_active` |
| `select count(*) from pg_policies where tablename = 'gift_purchase_intents';` | `0`, and row level security is enabled on the table |
| `select column_name, is_nullable from information_schema.columns where table_name = 'orders' and column_name in ('order_source','gift_claim_id','shipping_address');` | `order_source` present and not null with default `self`; `shipping_address` now nullable |
| `select proname from pg_proc where proname like 'gifvtme_%gift%';` | Includes `gifvtme_claim_wishlist_item`, `gifvtme_begin_gift_checkout`, `gifvtme_confirm_gift_order`, `gifvtme_fail_gift_order` |
| `select has_function_privilege('authenticated', 'public.gifvtme_confirm_gift_order(uuid,text,text)', 'execute');` | `false`. Only the service role may confirm a payment |
| Re-run `npm test` against the migrated database | Still 180 passing |
| Decide `gifvtme_orders_self_needs_address` | It ships `NOT VALID` so a historic row cannot block deployment. Once `orders` is known clean, run `ALTER TABLE public.orders VALIDATE CONSTRAINT gifvtme_orders_self_needs_address;` |

## Value sourcing

One check per row of the spec's Value sourcing table, exercising the edge that breaks if the value came from the wrong place. These are the behavioural counterpart to the design time review: a value can be sourced wrongly and still look right on a happy path.

| Step | Expected | Criteria |
| --- | --- | --- |
| Read a `gift_purchase_intents` row directly in the database, then try to resume with the stored `reference_hash` as the cookie value | Refused. Only the raw reference resumes, and it is never stored | AC-5 |
| Create an intent, then read `expires_at` | Exactly 24 hours after `created_at`, computed in SQL. Change the server clock's timezone and repeat: the interval is unchanged | AC-9 |
| Inspect the `auth_url` returned by `POST /api/gift/intent` | Passes through `getSafeRedirect`. Try to make it return an off site redirect by any input and confirm it cannot | AC-4 |
| Create an intent with the cookie present and a different `?c=` value in the URL | The cookie wins. Remove the cookie and repeat: `?c=` is used | AC-8 |
| Bind an intent to account A, then resume as B | No transition at all. Re-read the row: `bound_user_id` is still A, `status` is still `pending` | AC-10 |
| Reserve an item, wait, then resume the original intent | Availability is re-read at resume time. The intent's own copy of anything is never consulted | AC-13 |
| Change a product's price in Sanity mid signup, then resume | The resumed checkout shows and charges the new price. Assert the intent row still holds no price at all | AC-7, AC-33 |
| Reserve, then read `reserved_at` and `reserved_expires_at` | Both set at reservation, not at intent creation. A visitor who took an hour to sign up still gets a full 72 hours | AC-16 |
| Open gift checkout twice, ten minutes apart | The second call returns the first deadline. `reserved_expires_at` never moves | AC-16, AC-18 |
| Post to `/api/checkout` with `order_source: "wishlist"` and a `catalog_product_id` the caller has not claimed | 409. There is no request field that can name a wishlist item | AC-38 |
| Post a gift checkout with `display_price` set far below the real price | The order total is the server price. `display_price` only raises a price change warning | AC-33 |
| Post a gift checkout with two cart lines, then with quantity 2 | 400 both times, before any order row exists | AC-27 |
| Buy a gift on a wishlist with no destination | Payment completes, `fulfilment_blocked_reason = 'needs_recipient_address'`, and `shipping_address`, `shipping_city` and `shipping_state` are all null. No address was invented | AC-25 |
| Confirm a gift order, then read it back as the buyer through the API | Naira, formatted through `formatPrice`. No recipient street, apartment, phone or delivery instructions anywhere in the response | AC-22, AC-33 |
| Load a wishlist as its owner while a live claim exists on it | `is_reserved` is false on every item. Query `wishlist_gift_claims` as the owner: zero rows | AC-21 |
| Load the same wishlist as a different signed in giver | `is_reserved` is true on the claimed item, and no claimant id appears anywhere in the payload | AC-20 |
