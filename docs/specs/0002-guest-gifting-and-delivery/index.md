# 0002. Authenticated gifting and delivery for catalogue items on a shared wishlist

**Date**: 2026-09-18
**Status**: In Progress
**Revised**: 2026-09-18. The original decision let an unauthenticated visitor pay using an anonymous Supabase session. That is superseded. Browsing stays public; reserving and buying now require a Givtme account. See [Superseded decision](#superseded-decision) below and the revision note in [rationale.md](rationale.md).

## Summary

Anyone can open somebody's shared wishlist and inspect the gifts on it without an account. The moment they act, either reserving a gift or buying one, Givtme asks them to sign up or sign in. What makes this work is that their choice is remembered safely: the wishlist, the item, the product, the chosen variant and what they were trying to do are written to a short lived record on the server, and the browser is given only a random reference that means nothing on its own. After they sign in they land back on exactly that gift, at exactly the next step, never on a homepage. The reservation becomes a real record with states and a clock, the recipient's address is never shown to the buyer, and the wishlist owner is told nothing, so the surprise holds.

## Requirements

**User stories**

- As a visitor, I want to browse a friend's shared wishlist and open its gifts without signing in, so that a link someone sent me just works.
- As a visitor, I want signing up at the moment I choose a gift to return me to that gift, so that I do not have to find it again.
- As a signed in giver, I want to mark that I plan to buy an item so that other people looking at the same list do not buy it too.
- As a giver, I want to know when my gift is paid for and when it arrives so that I can trust that it happened.
- As a wishlist owner, I want to receive my gift as a surprise so that nobody tells me what is coming or who sent it.
- As a wishlist owner, I want givers to be able to have gifts delivered to me without handing my home address to anyone who opens my link.

**Acceptance criteria**

*The authentication boundary*

- **AC-1**: Viewing a shared wishlist and opening any item on it requires no account. Creating a reservation and starting a purchase both require an authenticated Givtme account.
- **AC-2**: A signed out visitor who clicks "I plan to buy this" or "Buy this gift" is prompted to sign up or sign in, and a purchase intent is recorded on the server first.
- **AC-3**: An already authenticated visitor is never shown the prompt. Reserving happens immediately, and buying goes straight to gift checkout.
- **AC-4**: After authentication the visitor lands on the exact next step for the exact wishlist, item, product and variant they chose. Never the homepage, the wishlist root, or a generic account page.

*The continuation, and how it is kept trustworthy*

- **AC-5**: The browser holds only a cryptographically random opaque reference, in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. No wishlist, item, product or variant data is ever placed in a query parameter, in `localStorage`, or in any client readable or client writable form.
- **AC-6**: The server stores only what is needed to resume: wishlist, wishlist item, catalogue product, selected variant options, intended action, timestamps, status and an immutable continuation id. No price and no product fact supplied by the client is stored, and none is trusted on resume.
- **AC-7**: On resume the server re-resolves the catalogue product, its availability, the variant and the authoritative price from Sanity. Nothing about price or product comes from the intent record.
- **AC-8**: The continuation survives a different tab, a closed and reopened browser, an email confirmation flow, and authentication completing on another device.
- **AC-9**: A purchase intent expires 24 hours after creation. An expired intent creates nothing and returns the visitor to the original wishlist item with the message "Your purchase session expired. The gift is still here if you'd like to continue."
- **AC-10**: An intent binds to the first account that authenticates and consumes it. If authentication completes as a different account than a bound intent expects, automatic continuation stops and the visitor is asked to restart or review the purchase. No intent is ever silently reassigned between accounts.
- **AC-11**: A consumed intent cannot create a second reservation or a second checkout. A retry after an ambiguous network response resolves the original operation and lands on the same next step, rather than creating a new one.
- **AC-12**: A purchase intent never blocks the wishlist item for anyone else, at any point before the authenticated reservation exists.
- **AC-13**: On resume the server revalidates the item. Still available means the reservation is created and the journey continues. Reserved by somebody else means the visitor is told it was just picked and offered a return to the wishlist or another gift, and the existing reservation is never overridden. Already purchased means it is shown as no longer available.
- **AC-14**: Expired, cancelled and consumed intents are cleaned up on a short retention schedule and never become permanent purchase records.

*Reservations*

- **AC-15**: Reserving creates exactly one active claim, owned by a permanent authenticated account. Two simultaneous reservations on the same item result in one `reserved` claim and one caller told the item is already reserved.
- **AC-16**: A `reserved` claim expires 72 hours after `reserved_at`, and the clock starts only when the authenticated reservation is created, never earlier. A `checking_out` claim holds for 60 minutes. Expiry is authoritative in the database, and a scheduled sweep releases claims past their expiry.
- **AC-17**: The person who made a reservation can release it. Nobody else can.
- **AC-18**: An abandoned checkout or a failed payment returns the claim to `reserved` on its original 72 hour clock, and the buyer can retry against the same claim and the same order.
- **AC-19**: A claim reaches `purchased` only from a verified Flutterwave payment, inside the same database transaction that confirms the order. No browser reachable path can set `purchased`.
- **AC-20**: Other visitors see a reserved item as reserved and still openable, and a purchased item as taken and not buyable. Neither state reveals the claimant's identity.
- **AC-21**: The wishlist owner receives no notification and sees no signal from a claim, a reservation or a purchase before delivery. No claim record and no giver identity is exposed to the owner through any page or data call.

*Gift checkout, privacy and fulfilment*

- **AC-22**: On every gift checkout and gift order surface the buyer sees only the recipient's first name, city and state, plus a note that delivery details are held securely. The full recipient address never reaches the browser.
- **AC-23**: Fulfilment receives the full recipient delivery record on the server, read from a snapshot frozen at order creation, so a later owner edit cannot change a paid order's destination.
- **AC-24**: A catalogue gift bought from a wishlist creates an order with `order_source = 'wishlist'` carrying the wishlist, the item, the claim, the recipient, the chosen delivery window and the gift message.
- **AC-25**: A gift purchase on a wishlist with no delivery destination still completes payment. The order is held with `fulfilment_blocked_reason = 'needs_recipient_address'` rather than failing, and no address is invented.
- **AC-26**: An external origin item is refused by gift checkout with a 400 and continues to use the affiliate redirect and purchase marking path.
- **AC-27**: A gift checkout order contains exactly one cart entry at quantity 1, matching the claimed item. Any other shape is rejected with a 400 before an order is created.
- **AC-28**: The delivery window stored on the order is one the buyer chose from windows the server computed for the recipient's state.
- **AC-29**: If the owner archives or removes the item, or switches the wishlist to private, unpaid claims and checkouts stop with a neutral message, and already paid orders proceed to fulfilment unchanged.
- **AC-30**: The owner is contacted before delivery only when delivery cannot proceed without them. That message names no giver, no item and no price, and every such contact is recorded.

*Integrity, and what must not regress*

- **AC-31**: Repeating a gift checkout request with the same `Idempotency-Key` returns the same order and never creates a second order or a second payment session.
- **AC-32**: Existing order authorization is unchanged. A buyer can read only their own orders, the `buyer_id` ownership model is untouched, and no row level security policy becomes more permissive than it is today.
- **AC-33**: Prices are server authoritative from `getActivePrice` and displayed in Naira through `formatPrice`. A client submitted `display_price` never determines what is charged.
- **AC-34**: If a verified payment arrives when the claim is no longer `checking_out` for that order, the order is still confirmed, because the money was captured, and is marked `fulfilment_blocked_reason = 'claim_conflict'`. No other visitor's claim is overwritten.
- **AC-35**: Cancelling or refunding a gift order releases its claim with `release_reason = 'order_cancelled'`, so the wishlist item becomes available again rather than showing as taken forever.
- **AC-36**: The buyer receives exactly one payment confirmation email. A repeated Flutterwave webhook for an order already confirmed sends no second email and fires no second contact event.
- **AC-37**: Existing unexpired `intent_flagged_by` values become `reserved` claims during migration, so no live reservation is lost at deploy.
- **AC-38**: No code path reads a wishlist item association for checkout from `localStorage` or any other client controlled store.

## Decision

**Chosen option**: Option 5, an authenticated purchase boundary with a server held purchase intent carrying the journey across sign up.

Browsing a shared wishlist stays public. Reserving and buying require a Givtme account. The purchase context is written to a short lived server record before the visitor leaves for authentication, and the browser is given only an opaque reference, so the journey resumes exactly where it stopped without the client ever holding anything it could forge.

Everything the previous revision decided about the claim model, the recipient privacy projection, the gift checkout route, the delivery window, the gift message and the transactional webhook is unchanged and still in force. Only the identity and continuation decisions are replaced.

Reasoning and options: see [rationale.md](rationale.md).

## Superseded decision

The previous revision of this spec chose **anonymous Supabase sessions**, so that a visitor could pay without ever creating an account. That decision is superseded in full. Removed from the architecture:

| Removed | Was for | Replaced by |
|---|---|---|
| Anonymous Supabase sign in, and the project setting enabling it | giving a guest an `auth.uid()` | ordinary signup and sign in, which already exist |
| Anonymous checkout | paying with no account | authenticated gift checkout |
| `orders.guest_access_token_hash` and `guest_access_token_expires_at` | letting a guest reach their order | existing `buyer_id` ownership, untouched |
| `POST /api/orders/[id]/resend-link` | re-issuing a guest order link | nothing, the buyer signs in |
| The emailed signed order access link | order access without a session | the order appears in the buyer's own order history |
| Anonymous identity sweep, `ANON_IDENTITY_RETENTION_DAYS`, `MAX_CLAIMS_PER_IP_PER_HOUR` | containing anonymous account creation | a per account active claim cap, which is meaningful now that accounts are real |
| In place identity upgrade through Supabase identity linking | turning a guest into an account holder | not needed, they are an account holder already |
| Anonymous user row level security requirements | letting `anon` write claims | claim policies for `authenticated` only |
| The `handle_new_user` prerequisite check | anonymous rows firing an unverified trigger | dropped, because ordinary signup already exercises that trigger in production |

The `localStorage` continuation that exists in the code today, `lib/checkout/pendingWishlistItem.ts`, is also removed. It is not merely weak: a signed in user can set `gifvtme.pending-wishlist-item` to any wishlist item they can read, buy the matching catalogue product, and have the webhook mark that other person's wishlist item `purchased`. The server held intent closes that.

## Feature design

### The journey

```
public wishlist  →  item  →  Reserve or Buy
                                  │
                   already signed in ──────────────► act immediately
                                  │
                              signed out
                                  │
                    create intent, set opaque cookie
                                  │
                       sign up or sign in prompt
                                  │
                    (password · OAuth · email confirmation, any device)
                                  │
                              /gift/resume
                                  │
        resolve → check expiry → bind account → revalidate item and price
                                  │
              available ──► create claim, consume intent ──► reserve done, or gift checkout
              reserved by someone else ──► "just picked", back to wishlist
              purchased ──► no longer available
              expired ──► "Your purchase session expired…", back to the item
```

### Data model

**New table `gift_purchase_intents`**

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` PK | no | the immutable continuation id, used in logs and support |
| `reference_hash` | `text` UNIQUE | no | SHA-256 of the opaque reference. **The raw reference is never stored**, so a database read cannot resume somebody's journey |
| `wishlist_id` | `uuid` FK `wishlists` | no | |
| `wishlist_item_id` | `uuid` FK `wishlist_items` | no | |
| `catalog_product_id` | `text` | no | identity only, never a trusted product fact |
| `combination_key` | `text` | yes | the selected variant |
| `selected_options` | `jsonb` | yes | the option labels chosen, for restoring the picker |
| `intended_action` | `text` | no | `reserve` or `buy` |
| `status` | `text` | no | `pending`, `consumed`, `expired`, `cancelled`. Default `pending` |
| `bound_user_id` | `uuid` FK `auth.users` | yes | set on the first authenticated resume |
| `bound_at`, `consumed_at` | `timestamptz` | yes | |
| `resulting_claim_id` | `uuid` FK `wishlist_gift_claims` | yes | what the intent turned into, so a retry resolves rather than repeats |
| `created_at` | `timestamptz` | no | default `now()` |
| `expires_at` | `timestamptz` | no | `created_at + 24 hours` |

Deliberately absent: any price, any product title, any image, any recipient data. The record carries identity and intent only, so there is nothing in it worth tampering with even if it could be.

Indexes: unique on `reference_hash`; `(expires_at) WHERE status = 'pending'` for the sweep; `(bound_user_id) WHERE status = 'pending'`.

Row level security: **no client readable or writable policy at all**. The table is reachable only through `SECURITY DEFINER` functions called by route handlers. A visitor never queries it, they only present a cookie.

**The opaque reference**

- 32 cryptographically random bytes, base64url encoded.
- Carried in a cookie named `gifvtme_purchase_intent`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 24 hours.
- `Lax` and not `Strict` on purpose: returning from an email confirmation link is a top level navigation from another site, and `Strict` would drop the cookie exactly when it is needed most.
- For authentication completing on **another device**, where no cookie exists, the same opaque reference is appended to the authentication redirect target, `/gift/resume?c=<reference>`. It carries no context itself, it is single use, it expires, and it binds to the first account that consumes it. The tradeoff is accepted knowingly: the reference does land in an email and possibly in a server log, and its entire power is to resume a purchase of a publicly viewable gift, once.

**Unchanged from the previous revision**: `wishlist_gift_claims`, `wishlist_delivery_destinations`, `recipient_contact_events`, and the additive `orders` columns, except that `guest_access_token_hash` and `guest_access_token_expires_at` are dropped from the design and `claimant_user_id` is now always a permanent account.

### State transitions

**Purchase intent**

| From | To | Trigger |
|---|---|---|
| none | `pending` | a signed out visitor clicks Reserve or Buy |
| `pending` | `pending`, now bound | first authenticated resume, `bound_user_id` set |
| `pending` bound | `consumed` | the claim is created, atomically, `resulting_claim_id` set |
| `pending` | `expired` | `now() > expires_at`, authoritative in SQL and materialised by the sweep |
| `pending` | `cancelled` | the item became unavailable on resume, or the visitor chose to restart |
| `consumed` | terminal | a further resume resolves to `resulting_claim_id` and creates nothing |

A resume presenting an intent whose `bound_user_id` is set and differs from `auth.uid()` performs no transition at all. It stops and asks the visitor to restart or review.

**Claim**: unchanged from the previous revision, including the `checking_out` restoration on payment failure, the conditional transition to `purchased` inside `gifvtme_confirm_gift_order`, the release on order cancellation or refund, and the rule that reopening gift checkout never extends the 60 minute hold. The one change is that `reserved_at` is now set when the authenticated reservation is created, which is after authentication, never before.

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/gift/intent` | POST | `wishlist_id`, `wishlist_item_id`, `combination_key`, `selected_options`, `intended_action` | `{ auth_url }`, plus the `Set-Cookie` | none, this is the signed out entry point | 404 wishlist not readable, 400 external origin, 409 item already purchased, 429 rate limited |
| `/gift/resume` | GET (page) | cookie, or `?c=` when the cookie is absent | redirect to the item, or to gift checkout | **authenticated**, redirects to sign in if not | renders the expired, just picked, purchased and account mismatch states |
| `/api/wishlists/items/[itemId]/claim` | POST | none, claimant from session | `{ state, expires_at }` | **authenticated** | 401, 404 not readable, 409 already reserved, 410 purchased, 429 |
| `/api/wishlists/items/[itemId]/claim` | DELETE | none | `{ released: true }` | own claim only | 401, 403 not the claimant, 404 |
| `/api/wishlists/items/[itemId]/flag-intent` | POST, DELETE | unchanged | forwards to the claim route | authenticated | deprecated, removed one release later |
| `/api/wishlists/[id]/gift/[itemId]/context` | GET | route params | product, server price, destination projection, delivery windows | authenticated, claim holder only | 401, 403 not the claim holder, 404, 409 no active claim |
| `/api/checkout` | POST | existing body plus `order_source` and gift fields. **No `claim_id` and no `wishlist_item_id` from the client** | `order_id`, `payment_link`, `price_changes` | authenticated, as today | 401, 400 external origin or a gift cart that is not one item at quantity 1, 409 no active claim for this user, 409 item unavailable |
| `/api/checkout/retry` | POST | unchanged | unchanged | authenticated | unchanged |
| `/api/flutterwave/webhook` | POST | unchanged | unchanged | `verif-hash` secret | unchanged |
| `/api/orders/[id]` | GET | unchanged | unchanged | **unchanged, `buyer_id` ownership only** | unchanged |
| `/api/wishlists/[id]/destination` | GET, PUT, DELETE | destination fields | destination | wishlist owner only | 401, 403, 404, 422 |
| `/api/claims/sweep` | POST | none | counts released, intents expired | cron secret | 401 |

Note on `/api/checkout`: the previous revision already removed `claim_id` as a client input. This revision goes further and removes `wishlist_item_id` too. The wishlist association is now derived entirely from the caller's own active claim, which is what closes the `localStorage` tampering hole rather than merely relocating it.

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| Create intent | the opaque reference | 32 random bytes generated server side. Its SHA-256 is stored; the raw value exists only in the cookie and, for cross device, the redirect |
| Create intent | `expires_at` | computed in SQL as `now() + interval '24 hours'` |
| Create intent | `auth_url` | `/signup` or `/login` with `redirect=/gift/resume`, passed through the existing `getSafeRedirect`, which already blocks open redirects |
| Resume | the intent | looked up by SHA-256 of the presented reference. A cookie is preferred; `?c=` is used only when no cookie is present |
| Resume | the acting account | session `auth.uid()`. Compared against `bound_user_id` before anything else happens |
| Resume | item availability | re-read from `wishlist_items_with_status` and `wishlist_gift_claims` at resume time, never from the intent |
| Resume | product, variant, availability, price | re-resolved from Sanity through `CART_PRICES_QUERY` and `getActivePrice`. The intent supplies identity only |
| Reserve | `claimant_user_id` | session `auth.uid()`, always a permanent account |
| Reserve | `reserved_at`, `expires_at` | computed in SQL when the authenticated claim is created |
| Open gift checkout | the active `claim_id` | resolved on the server from `auth.uid()` plus `wishlist_item_id`. Never a client input |
| Open gift checkout | recipient first name, city, state, `has_destination` | `gifvtme_get_destination_projection`, a `SECURITY DEFINER` function returning four fields and nothing else |
| Open gift checkout | delivery window options | derived from the projection's `state` plus today's date, through `lib/delivery/windows.ts` |
| Create gift order | the wishlist association | **the caller's own active claim**, not a client supplied id and not `localStorage` |
| Create gift order | `total_amount` | server computed from `getActivePrice`. The submitted `display_price` only raises a price change warning |
| Create gift order | `recipient_destination_snapshot` | `SECURITY DEFINER` read of the full destination inside the order transaction |
| Create gift order | buyer email, name, phone | the checkout form, prefilled from the authenticated account as it is today |
| Create gift order | `delivery_window_start` and `_end` | the buyer's choice, revalidated on the server against the same lead time table |
| Confirm payment | claim transition to `purchased` | `gifvtme_confirm_gift_order` only, after amount and currency match |
| Read order | ownership | `buyer_id = auth.uid()`, exactly as today |
| Fulfilment read | full recipient address | `recipient_destination_snapshot`, service role only |

### Key invariants

1. No reservation and no order exists without a permanent authenticated account behind it.
2. A purchase intent never blocks a wishlist item. Only a claim does.
3. The client never holds purchase context, only an opaque reference. Nothing the client presents is used as a product, price or association fact.
4. An intent is consumed exactly once, atomically with the creation of the claim it produced. A second resume resolves to `resulting_claim_id` and creates nothing.
5. An intent bound to one account is never usable by another.
6. At most one claim per `wishlist_item_id` in `reserved`, `checking_out` or `purchased`. Enforced by a partial unique index, not application code.
7. `state = 'purchased'` is reachable only through `gifvtme_confirm_gift_order`, in the same transaction that confirms the order. **The webhook today is not transactional**, it is four sequential Supabase REST calls each failing with only a `console.error`, so this remains new work and remains the highest value correctness fix in this spec.
8. An order with `order_source = 'wishlist'` always has `gift_claim_id` and `recipient_wishlist_id`, and either a `recipient_destination_snapshot` or a `fulfilment_blocked_reason`. It has exactly one `order_items` row at quantity 1.
9. `wishlist_items.origin = 'external'` never reaches gift checkout.
10. No buyer facing response ever contains a recipient's `street_address`, `apartment`, `phone` or `delivery_instructions`.
11. The wishlist owner's own queries never join `wishlist_gift_claims`.

### Security model

| Actor | May | May not |
|---|---|---|
| Signed out visitor | view a readable shared wishlist and its items, create a purchase intent | reserve, buy, read any order, read any intent, block any item |
| Authenticated buyer | reserve, release their own reservation, buy, read their own orders | read another person's claim, intent or order, or see any recipient's full address |
| Wishlist owner | read and write their own `wishlist_delivery_destinations` | read `wishlist_gift_claims` for their own items, see giver identity, or be notified of a claim |
| Service role | read `recipient_destination_snapshot` for fulfilment, run the sweeps, write contact events | nothing exposed through a customer route |

**Row level security**

- `gift_purchase_intents`: no client policy at all. Reachable only through `SECURITY DEFINER` functions.
- `wishlist_gift_claims`: `SELECT` limited to `claimant_user_id = auth.uid()`, granted to `authenticated` only. No policy grants the owner read access, which is how AC-21 is enforced at the data layer rather than in the UI. Other visitors see only a boolean through the existing `wishlist_items_with_status` view, never a claimant id.
- `wishlist_delivery_destinations`: owner only, `authenticated` only, never `anon`. Buyers read it exclusively through the projection function.
- `orders`: **entirely unchanged**. This revision adds no order policy, widens none, and removes none. That is the main security dividend of dropping anonymous checkout.

**Compliance scope**: payment initiation plus personal data including a home address and a phone number. Card data never touches Givtme because Flutterwave hosts the payment page, so PCI DSS scope stays at SAQ A. The recipient address belongs to somebody who is not the buyer, which is why the projection boundary is a hard invariant. Audit logging of owner contact is not negotiable, per AC-30. Purchase intents hold no personal data beyond identifiers and are deleted on a short retention schedule.

### Configuration required

- `PURCHASE_INTENT_TTL_HOURS`: default 24. Long enough for an email confirmation round trip. Safe to be this long only because an intent blocks nothing.
- `PURCHASE_INTENT_RETENTION_DAYS`: default 7. How long consumed, expired and cancelled intents are kept before deletion.
- `MAX_ACTIVE_CLAIMS_PER_VISITOR`: default 5, counted per account as claims in `reserved` or `checking_out`. Meaningful now that every claimant is a real account.
- `MAX_INTENTS_PER_IP_PER_HOUR`: default 30. Intent creation is the one thing a signed out visitor can do, so it is the one thing that needs an IP limit. It blocks nothing and holds no personal data, so this is about database noise rather than gift hoarding.
- `CLAIM_RESERVATION_HOURS`: default 72. Present so the conflict with the current 24 hours is configurable during rollout rather than hardcoded twice again.
- `CLAIM_CHECKOUT_HOLD_MINUTES`: default 60.
- `vercel.json`: one cron entry for `/api/claims/sweep`, which handles both claim expiry and intent cleanup. Note that `app/api/occasions/archive` is already missing from `vercel.json`, so treat the file as needing a review rather than a blind append.

No new secret is required, and no Supabase project setting has to change. Both were consequences of anonymous sign in and are gone with it.

### Critical test scenarios

- Happy path, signed out: a visitor with no account opens a public wishlist, clicks Buy this gift, signs up, and lands directly on gift checkout for that exact item and variant, then pays. Verifies **AC-1**, **AC-2**, **AC-4**, **AC-24**.
- Happy path, signed in: an authenticated visitor clicks Buy this gift and reaches gift checkout with no prompt and no intent created. Verifies **AC-3**.
- Reserve behind the gate: a signed out visitor clicks "I plan to buy this", signs in, and returns to the same item with the reservation created against their account. Verifies **AC-1**, **AC-2**, **AC-4**, **AC-15**.
- Tamper: the cookie value is edited, replaced with another intent's reference, and removed. All three are refused and create nothing. Verifies **AC-5**, **AC-11**.
- No client context: assert that no request from the browser carries a wishlist item id, product id or price that the server then trusts, and that `localStorage` holds no purchase context. Verifies **AC-5**, **AC-38**.
- Cross device: signup is completed by confirming an email on a phone. The phone lands on the right gift checkout. Verifies **AC-8**.
- Expiry: resume an intent older than 24 hours. Nothing is created and the visitor sees the expired message on the original item. Verifies **AC-9**.
- Account switch: bind an intent to account A, then resume it as account B. Continuation stops, nothing is created, and no reservation moves. Verifies **AC-10**.
- Replay: resume the same consumed intent three times. One claim exists, and every resume lands on the same next step. Verifies **AC-11**.
- Taken during signup: a second visitor reserves the item while the first is signing up. The first is told it was just picked, the second's reservation is untouched. Verifies **AC-12**, **AC-13**.
- Purchased during signup: the item is bought while the first visitor signs up. They are shown it is no longer available. Verifies **AC-13**.
- Concurrency: two authenticated requests reserve the same item in the same instant. Exactly one row exists and the loser receives a 409. Verifies **AC-15**.
- Transaction boundary: a webhook arrives with a mismatched amount. The order stays `pending_payment` and the claim stays `checking_out`. Verifies **AC-19**.
- Slow payment race: the claim expires and is re-reserved while a bank transfer settles. The order confirms with `claim_conflict` and nobody's claim is overwritten. Verifies **AC-34**.
- Cancelled gift: a confirmed gift order is cancelled and a delivered one refunded. Both claims release and both items return to available. Verifies **AC-35**.
- Privacy: every buyer facing response for a gift order is asserted to contain no recipient `street_address`, `phone` or `delivery_instructions`. Verifies **AC-22**.
- Owner blindness: the owner loads their wishlist, items, dashboard and data calls while a claim and a paid order exist. Nothing appears and nothing is queued. Verifies **AC-21**.
- Authorization unchanged: compare the `orders` policy set before and after. It is identical. An authenticated user requesting another user's order is refused. Verifies **AC-32**.
- Migration: an `intent_flagged_at` 2 hours old becomes a `reserved` claim, one 30 hours old does not, and two live flags on one item do not violate the unique index. Verifies **AC-37**.

## Build plan

Ordered as Tracer Bullet, the project default in the scope header. Slice 1 threads a signed out visitor all the way from a public wishlist through signup to a verified payment, taking the AC-25 blocked address path so no owner destination work is needed to prove the thread.

**Slice 1: the thread, a signed out visitor signs up and pays**

_Build progress, 2026-09-18 (`/develop`). Application code for all fourteen steps is written and green: `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm test` (180 passing) all pass. The SQL is written as `gifvtme_migration_026_gift_claims_and_intents.sql` and `gifvtme_migration_027_gift_order_transactions.sql` but **has not been applied to any database**, because this environment has no Supabase CLI and no database connection. The steps whose deliverable is SQL therefore stay unticked until somebody applies both files and confirms the schema is live. Nothing in this slice runs before that._

1. Migration A: create `wishlist_gift_claims` with its partial unique index and sweep index, create `gift_purchase_intents` with no client policy, and add the additive `orders` columns with the `order_source` check constraint. Satisfies **AC-15**, **AC-24**.
2. Add `gifvtme_claim_wishlist_item` and `gifvtme_release_wishlist_item_claim`, granted to `authenticated` only, with expiry evaluated in SQL. Satisfies **AC-15**, **AC-16**, **AC-17**.
3. [x] Add `POST /api/gift/intent`: validate the wishlist is readable and the item is a catalogue item, create the intent, set the `Secure` `HttpOnly` `SameSite=Lax` cookie, and return the authentication URL through the existing `getSafeRedirect`. Satisfies **AC-2**, **AC-5**, **AC-6**.
4. [x] Add `/gift/resume`: resolve by cookie or `?c=`, check expiry, bind or reject on account mismatch, revalidate item and re-resolve product and price, then create the claim and consume the intent atomically, or render the expired, just picked, purchased or mismatch state. Satisfies **AC-4**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**.
5. [x] Wire `GiverItemActions` and the existing `AuthGateSheet` to the new entry point, skipping both entirely for an authenticated visitor. Satisfies **AC-1**, **AC-3**.
6. [x] Add `POST` and `DELETE /api/wishlists/items/[itemId]/claim`, authenticated only. Satisfies **AC-15**, **AC-17**.
7. Extend `wishlist_items_with_status` and [shared.ts](lib/wishlist/shared.ts) to expose a boolean reserved state derived from claims, exposing no claimant id. Satisfies **AC-20**, **AC-21**.
8. [x] Add the gift checkout route `app/w/[id]/gift/[itemId]/checkout/` behind an auth guard, plus `GET /api/wishlists/[id]/gift/[itemId]/context`, resolving the claim server side. Satisfies **AC-1**, **AC-22**.
9. Extend `checkoutSchema` and `gifvtme_create_checkout_order` with `order_source`, `gift_message`, `surprise_preference`, the window fields and `fulfilment_blocked_reason`. Satisfies **AC-24**, **AC-25**.
10. [x] Extend `POST /api/checkout` for the wishlist source: derive the wishlist association from the caller's own active claim, **delete `wishlist_item_id` as a client input**, reject a gift cart that is not one item at quantity 1, return 409 when the caller holds no active claim, and move the claim to `checking_out` without extending an existing hold. Satisfies **AC-26**, **AC-27**, **AC-31**, **AC-33**, **AC-38**.
11. [x] Delete `lib/checkout/pendingWishlistItem.ts` and its three call sites. Satisfies **AC-38**.
12. Add `gifvtme_confirm_gift_order`, a `SECURITY DEFINER` RPC doing the order confirm, the conditional claim transition to `purchased`, the wishlist item update and the master item update in one transaction. Satisfies **AC-19**.
13. Add `gifvtme_fail_gift_order`: mark the order `payment_failed` and restore the claim to `reserved` on its original clock in one transaction, going straight to `expired` when that clock has run out. Satisfies **AC-18**.
14. [x] Wire both into the Flutterwave webhook, confirming the order with `fulfilment_blocked_reason = 'claim_conflict'` when the conditional claim update matches nothing. Satisfies **AC-19**, **AC-34**.

**Slice 2: the recipient address and its privacy boundary**

15. Migration B: create `wishlist_delivery_destinations` with owner only policies, and `gifvtme_get_destination_projection`. Satisfies **AC-22**, **AC-23**.
16. Add `GET`, `PUT` and `DELETE /api/wishlists/[id]/destination` and the owner facing form in the share flow. Satisfies **AC-23**.
17. Wire the projection into gift checkout context and freeze `recipient_destination_snapshot` inside the order transaction. Satisfies **AC-22**, **AC-23**, **AC-25**.
18. Add `lib/delivery/windows.ts` and the window picker, revalidating the chosen window on the server. Satisfies **AC-28**.

**Slice 3: confirmation and lifecycle**

19. Send the payment confirmation email, gated so a repeated webhook cannot send it twice. Satisfies **AC-36**.
20. Add `POST /api/claims/sweep` plus its `vercel.json` entry, releasing expired claims, restoring lapsed `checking_out` claims, expiring stale intents and deleting intents past retention. Satisfies **AC-14**, **AC-16**, **AC-18**.
21. Release the claim when its order is cancelled or refunded, driven from the order status change. Satisfies **AC-35**.

**Slice 4: migration and hardening**

22. Migration C: backfill `intent_flagged_by` rows newer than 24 hours into `reserved` claims, taking the most recent flag per item so the unique index cannot be violated. Stop writing the old columns and leave them read only. Convert `flag-intent` into a forwarder. Satisfies **AC-37**.
23. Add the per account active claim cap and the per IP intent creation limit. Satisfies **AC-15**.
24. Handle owner side mid flight changes: releasing unpaid claims on archive, delete or visibility change, while leaving paid orders alone. Satisfies **AC-29**.
25. Add `recipient_contact_events` and the neutral operations contact path for `needs_recipient_address` and `claim_conflict`. Satisfies **AC-30**.
26. Confirm through a policy diff that `orders` authorization is byte for byte unchanged. Satisfies **AC-32**.
27. Remove the `flag-intent` forwarder and its two RPCs one release after step 22. Satisfies **AC-37**.

## Migration plan

**Strategy**: strangler, three migrations across two releases. Materially lower risk than the superseded revision, because no authentication mechanism changes and no order policy is touched.

**Phases**

1. **Migration A and slice 1**, additive only. New claims and intents tables, new order columns. The old intent flag path still works. Both systems coexist. `lib/checkout/pendingWishlistItem.ts` is deleted in this phase, which is a behavior change for the existing authenticated wishlist checkout and must ship together with step 10.
2. **Migration B and slices 2 and 3**, additive only.
3. **Migration C, slice 4**. Backfill unexpired flags into claims, switch every reader to claims, convert `flag-intent` to a forwarder, stop writing the old columns.
4. **One release later**, drop `intent_flagged_by`, `intent_flagged_at` and the two intent RPCs, in a migration outside this spec's build plan.

**Rollback**

- Phases 1 and 2 roll back by reverting the deployment. The new tables are unreferenced by old code and can be left in place.
- Phase 3 is the only risky one. The old columns are kept and populated up to cutover, so reverting restores the old behavior with at most 24 hours of reservations lost, which matches the current expiry anyway.
- There is no equivalent of the previous revision's "disable anonymous sign in" emergency stop, because nothing is being enabled. The rollback is an ordinary deployment revert, which is a simplification.

**Risks**

- The `orders` table has no migration file backing its original creation and no row level security policies visible in this repository. AC-32 promises those policies are unchanged, and that promise cannot be verified from the repository alone. Read them from the live database first.
- Steps 10 and 11 must ship together. Deleting `pendingWishlistItem` without deriving the association from the claim would silently break wishlist association for existing authenticated buyers; shipping step 10 without step 11 would leave the exploitable path live.
- `SameSite=Lax` is required for the email confirmation return. If a future change tightens it to `Strict`, cross site returns will silently lose the cookie and fall back to the `?c=` path, which will look like an intermittent bug rather than a policy change.
- Backfilling flags into claims can violate the partial unique index if any item carries two live flags. The backfill must take the most recent flag per item.

## Consequences

**Positive**

- No new authentication surface at all. Ordinary signup and sign in already exist and are already exercised in production, so the riskiest unknown in the superseded revision, an unverified `handle_new_user` trigger firing for a brand new kind of user, disappears entirely.
- `orders` authorization is untouched. No policy is added, widened or removed, and the `buyer_id` ownership model keeps working exactly as it does today.
- Every claim, order and payment has a real, supportable, contactable person behind it. Support can actually help somebody whose gift went wrong.
- An existing exploitable hole closes: the client can no longer nominate which wishlist item an order marks purchased, because the association comes from the caller's own claim.
- The purchase context stops being client controlled, which removes tampering, replay and account switching as classes of bug rather than as individual defects.
- Nothing is lost from the previous revision's gifting design. The claim model, the recipient privacy projection, the transactional webhook fix, the delivery window and the gift message all survive intact.

**Negative and tradeoffs**

- Some givers will not sign up, and those gifts will not be bought. That is the accepted cost of this decision, and it is a product choice rather than a technical one. It should be measured, because feature 8 can measure it: the drop off between intent created and intent consumed is exactly this number.
- The journey is longer for a first time giver: wishlist, item, buy, signup, email confirmation, resume, checkout, payment. Every step is a place to lose somebody.
- A purchase intent is a new concept that did not exist before, with its own table, its own sweep and its own four failure screens. That is real surface, and its failure modes are subtle, particularly the account mismatch case.
- The opaque reference in the cross device redirect does land in an email and possibly in logs. It is single use, expiring and worth little, but it is not nothing.
- Intent rows accumulate for every signed out visitor who clicks Buy and never finishes. Cheap, but it needs the retention sweep to stay cheap.
- Two of the ACs deliberately promise that something did **not** change, AC-32 on order policies and AC-38 on client controlled context. Those need a diff and an assertion rather than a feature test, which is an unusual shape for a test suite.

**Neutral**

- `AuthGateSheet`, `getSafeRedirect`, `withRedirect` and the OAuth callback's redirect handling all already exist and all already work. This revision mostly gives them a trustworthy payload to carry.
- `estimated_delivery` stays for self purchase orders while gift orders use the window columns. Two representations of delivery timing coexist until feature 10 reconciles them.
- Self purchase orders still confirm through the webhook's four sequential non transactional updates. Only gift orders get `gifvtme_confirm_gift_order`.
- The directory name `0002-guest-gifting-and-delivery` is now slightly misleading, since gifting is no longer by guests. Renaming it would break the scope link for no functional gain, so it stays.

## Follow-up

- [ ] Read the live `orders` row level security policies from the database and check them into this repository. AC-32 cannot be verified without them.
- [ ] Measure the drop off between intent created and intent consumed, through feature 8. It is the direct cost of requiring an account, and it is the number that would justify revisiting this decision.
- [ ] Wrapping choice is still deferred out of this slice. Feature 10 needs it.
- [ ] The five minute sale grace period in [getActivePrice.ts](lib/flutterwave/getActivePrice.ts) is inherited unchanged. Root `AGENTS.md` records it as an unresolved conflict, and this spec does not settle it.
- [ ] Feature 3's known privacy defects remain a prerequisite for this feature's guarantees. See the premise note in [rationale.md](rationale.md).
- [ ] `app/api/occasions/archive` is missing from `vercel.json`. Adding the sweep cron is the moment to fix it.
- [ ] Measure the shared wishlist page against its 3 second throttled 3G budget after the claims join lands on `wishlist_items_with_status`.
- [ ] Wishlist items with a quantity above 1 still cannot be gifted more than once, because a claim is one per item.
- [ ] Unify self purchase order confirmation onto `gifvtme_confirm_gift_order` once gift orders prove it.
