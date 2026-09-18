# 0002 rationale: authenticated gifting and delivery

Reasoning and options for [index.md](index.md). Not read during a build.

## Revision note, 2026-09-18

**Option 2, anonymous Supabase sessions, is superseded.** It was chosen because it admitted a guest to checkout without removing any of the four existing authentication guards, and because it kept `orders.buyer_id` non null so the idempotency index went on working. Both of those arguments were sound, and neither survives the product decision that replaced it.

The product decision changed: browsing a shared wishlist stays public, but reserving and buying now require a Givtme account. That is not a technical correction of Option 2, it is a different answer to a different question. Once an account is required, the entire problem Option 2 solved stops existing: there is no guest to represent, no guest order to grant access to, no anonymous row level security to write, and no identity to upgrade later.

What replaces it is **Option 5**, below. The interesting part of the design moves from "how do we represent somebody with no account" to "how does a purchase survive the trip through signup without the browser being trusted with anything".

Everything Option 2 decided about gifting itself is retained unchanged: the claim model and its states, the partial unique index that makes reservation races safe, the recipient address projection, the frozen destination snapshot, the separate gift checkout route, the delivery window, the gift message, and the finding that the Flutterwave webhook is not transactional. That last one is explicitly still owed and is unaffected by who is buying.

## Context

> ⚠️ Premise note: this feature's central promise, that a giver can have a gift delivered without ever seeing the recipient's address, is built on top of scope feature 3, public shareable wishlists, which is itself still `in-progress` and carries two recorded privacy defects. Migration 013's shared wishlist function returns raw item prices even when `prices_visible` is false, with the hiding done later in application code, and it also returns giver identity fields. A privacy contract enforced at the API boundary here can be undermined by a data boundary below it that already leaks. The right framing is that feature 3's data boundary is a prerequisite, not a parallel workstream: the projection function this spec introduces should become the pattern feature 3's own redaction is moved to, rather than a second redaction layer sitting above a leaky one. Proceeding as designed, with this recorded as a follow up and as a verification gate before release.

Givtme already has a working catalogue commerce path. A signed in buyer adds an item to a localStorage cart, checks out at `/checkout`, and `POST /api/checkout` computes an authoritative price from Sanity, creates the order and its items in one Postgres transaction through `gifvtme_create_checkout_order`, and hands back a Flutterwave payment link. A signed webhook verifies the payment, confirms the order, and already flips the linked `wishlist_items` row to `purchased`. That path is careful: it has an idempotency key, a payment claim column that prevents two concurrent payment sessions for one order, a price change warning persisted on the order, and a status transition trigger in the database.

It is also entirely authenticated, in four independent places. The `/checkout` page redirects when there is no user. The API returns 401 through `getAuthenticatedApiUser`. The order creation function raises when `auth.uid()` differs from the passed buyer id, and is granted only to `authenticated`. And every order read path filters on `buyer_id = auth.uid()`. Removing those guards to admit a guest would dismantle the most carefully built part of the application.

The reservation side is much weaker than the checkout side. "I plan to buy this" is not a record. It is two columns on `wishlist_items`, `intent_flagged_by` and `intent_flagged_at`, with last write wins semantics and a 24 hour window that is duplicated in two places: `INTENT_FLAG_WINDOW_MS` in `lib/wishlist/shared.ts` evaluates it at read time in TypeScript, and the RPC evaluates its own copy in SQL. Nothing ever clears an expired flag, so the stored data is untrue as soon as a day passes. The scope's own plan for feature 3 says 72 hours, so the number is wrong as well as duplicated. Only an authenticated user can flag at all, which means the visitors this feature exists to serve cannot use the one mechanism that prevents duplicate gifting.

There is no owner saved delivery destination anywhere in the schema. Not on `users`, not on `wishlists`. Addresses exist only as `shipping_*` columns captured per order. So "reuse the recipient's saved destination" is not a lookup that needs wiring, it is storage that does not exist. That matters more than it first appears, because the obvious alternative, asking the owner for their address once a gift has been bought, is a message that tells them a gift is coming. The surprise constraint therefore forces the address to be collected before any gift exists.

Not deciding leaves the product's headline journey broken at its narrowest point. Feature 3 delivers visitors to a shared wishlist, and feature 10 promises delivery and a photo, but between them a visitor without an account currently cannot buy anything, and two visitors can both believe they are buying the same gift.

## Options considered

### Option 1: Fix in place, relax the existing guards for a wishlist context

Keep one `/checkout` route and one checkout API, and make each of the four authentication gates conditional on a wishlist gift context. Represent the guest with a nullable `buyer_id` and a separate guest token column, writing orders through the service role where RLS would otherwise block them.

**Pros**

- No new authentication surface and no Supabase project setting to enable.
- Reuses the existing page, form and layout wholesale, so the least new UI code.
- The service role write pattern is already established in this repository by the Flutterwave webhook.

**Cons**

- It turns the most security sensitive page and handler in the application into code that branches on a request parameter, which is exactly where authorization bugs live.
- A nullable `buyer_id` silently breaks the partial unique index on `(buyer_id, idempotency_key)`, because Postgres treats nulls as distinct. Guest retries would stop deduplicating, on a money path, without any error to notice.
- Authorization moves out of row level security and into application code for guests only, so the two buyer types get two different enforcement mechanisms with different failure modes.
- Every future order query must remember the guest case, forever.

### Option 2: Anonymous sessions plus a separate gift route, reusing the checkout engine · SUPERSEDED 2026-09-18

Give the guest a real but anonymous Supabase session, so `auth.uid()` is populated and every existing guard passes on its own terms. Add a distinct gift checkout route under the shared wishlist that reuses the same checkout API, and introduce a durable claims table and an owner set delivery destination the buyer reads only through a projection.

**Pros**

- Not one existing guard is removed or made conditional. The order creation function, its grant, the idempotency index and the order policies are untouched.
- `buyer_id` stays not null, so idempotency keeps working for guests with no change at all.
- Signing up later upgrades the same identity, so a guest's order follows them with no data movement and no email matching.
- Claims become a real record with states, which the gift pooling feature can reuse rather than reinvent.

**Cons**

- Creates an `auth.users` row for every visitor who reserves, which is data growth, retention obligation and an abuse surface needing rate limiting and sweeping.
- Depends on a Supabase project setting that cannot be version controlled, so environments can drift.
- The `handle_new_user` trigger fires on every anonymous sign in and its body is not in this repository, so there is an unverified dependency in the riskiest step.
- A second checkout page means some duplicated layout and form work, and some visual drift over time.

### Option 3: Replace directly with a second, purpose built gift commerce path

Build a separate gift checkout handler, gift order table and gift payment flow, tuned for the wishlist case from the start, leaving the existing self purchase path completely alone.

**Pros**

- Total isolation. No risk at all to the working self purchase money path.
- The gift flow can be modelled exactly as gifting needs, with no compromises inherited from cart based checkout.

**Cons**

- It is a second commerce system, which root `AGENTS.md` and the brief both explicitly rule out.
- Pricing, variant checking, payment verification, idempotency and order status would exist twice and drift, and the flash sale grace period already shows how easily one pricing rule becomes two.
- Double the surface to keep correct on the highest risk code in the product, for a flow that is 90 percent identical.

### Option 4: A bearer secret on the claim, with anonymous users only at payment

Keep `claimant_user_id` nullable on the claims table and identify a browsing visitor by a bearer secret stored on the claim, the same shape as the guest order token. Mint a real anonymous Supabase session only at the moment of order creation, where `auth.uid()` is genuinely required.

**Pros**

- Narrows the blast radius of "does every authorization path handle an anonymous user correctly" to one table, instead of assuming it everywhere session code touches `auth.uid()`.
- Creates far fewer `auth.users` rows, because only visitors who actually start paying get an identity, which makes the abuse surface and the retention obligation much smaller.

**Cons**

- Two identity mechanisms rather than one, and a bridging step that must transfer a bearer identified claim onto a session identified order. That handoff is exactly the sort of seam where a claim can be lost or hijacked.
- The claims table then needs its own authorization logic in application code, because a nullable `claimant_user_id` cannot be expressed as a row level security policy.
- It does not avoid anonymous sign in, it only delays it, so the unverified `handle_new_user` trigger risk remains in full.

### Option 5: Authenticated purchase boundary, with a server held purchase intent · CHOSEN 2026-09-18

Browsing stays public. Reserving and buying require an account. Before a signed out visitor leaves for signup, the server records what they were trying to do, and hands the browser only a random opaque reference in a `Secure` `HttpOnly` cookie. After authentication the server resolves that reference, binds it to the account, revalidates everything from source, and continues the journey at the exact step it stopped.

**Pros**

- Adds no authentication mechanism at all. Signup, sign in, the OAuth callback, `getSafeRedirect` and `AuthGateSheet` already exist and already work in production.
- Touches no order authorization. Nothing about `buyer_id` ownership or the `orders` policies changes, which was the hardest thing to be confident about in Option 2.
- Removes a class of bug rather than a defect. Tampering, replay, expired context and account switching stop being possible once the client holds nothing but an opaque reference.
- Closes an exploitable hole that exists in shipped code today, described in the evidence section below.
- Every claim and every order has a real, contactable person behind it, which matters for support, for fraud, and for the surprise rules that depend on knowing who a giver is.

**Cons**

- Some givers will not sign up, and those gifts will not be bought. This is the real cost, and it is a product cost rather than a technical one.
- A first time giver's journey gets longer, and every added step loses some of them.
- Introduces a genuinely new concept, the purchase intent, with its own table, its own sweep and four distinct failure screens. The account mismatch case in particular is subtle.
- The cross device return puts the opaque reference in an email and possibly in logs. Single use and expiring, but not nothing.

## Rationale

**On the revised decision.** Option 5 is not chosen over Option 2 on technical merit, it is chosen because the product decision changed and Option 2 answers a question no longer being asked. What is worth recording is that the change is a net simplification rather than a compromise. Option 2's strongest argument was that it removed no existing guard; Option 5 does better, it needs no new authentication surface whatsoever. Option 2's most uncomfortable risk was that every casual visitor minted an `auth.users` row through an unverified `handle_new_user` trigger; that risk is gone rather than mitigated. And the emergency stop Option 2 needed, disabling anonymous sign in, is replaced by an ordinary deployment revert.

The one thing Option 5 must get right that Option 2 did not have to is the continuation. Option 2 never needed one, because the guest never left to authenticate. Requiring an account creates a gap in the middle of a purchase, and everything dangerous about this design lives in that gap. Hence the rule that the browser carries an opaque reference and nothing else, and the rule that resume re-resolves product, variant, availability and price from source rather than trusting anything stored. A purchase intent deliberately contains no price and no product fact, so that even a hypothetical tampering of the record itself would achieve nothing.

The decision not to hold the item during signup follows from the same instinct. A hold that is not attached to an identified person is exactly what this revision set out to remove, and holding an item for an unidentified browser would have quietly reintroduced it under another name. The cost is a real race, where somebody finishes signing up and finds the gift taken, and that is handled honestly with a specific message rather than hidden.

The 24 hour intent lifetime deserves a note, because it was initially set at 30 to 60 minutes. The short window was premised on an intent that could block an item, where a long life is expensive. Once the intent blocks nothing, its only job is to outlive an email confirmation, and 24 hours costs nobody a gift. The two figures were reconciled in favour of 24 hours for that reason.

**On the parts that did not change.** Everything below this paragraph was the reasoning for the original decision and still holds, except where it argues for anonymous identity.

Option 2 won on the single constraint that dominated everything else: the brief says not to simply remove the existing guards, and anonymous sessions are the only option that does not touch them at all. Every other approach makes the four authentication gates conditional, and conditional authorization on a payment path is the failure pattern that produces the worst kind of bug, one that only appears for a subset of users and is invisible in the common case.

The idempotency index settles it beyond preference. `orders_idempotency_key_idx` is a partial unique index on `(buyer_id, idempotency_key)`. Option 1's nullable `buyer_id` makes every guest row distinct to that index, so the guarantee against double orders quietly disappears exactly where money is involved, with no error and no test failure unless somebody thinks to write one. Anonymous sessions keep `buyer_id` populated, and the guarantee holds for guests without a line of work.

That cost was accepted knowingly at the time: anonymous sign in minting user rows for casual visitors, needing rate limiting and an identity sweep, with the unverified `handle_new_user` trigger as the sharpest edge. **None of that applies any more.** It is retained here only to show what the superseding decision bought.

On the claim model, a table was chosen over extending the two existing columns because the required behavior does not fit in two columns: five states, two different clocks, a link to an order, a release reason for support, and a guest identity. More importantly, the partial unique index moves race safety from application code into Postgres. The current last write wins behavior is not a lesser version of that, it is the specific bug where two visitors both think they hold the same gift, which is the problem this feature exists to solve.

On the address, the surprise constraint drove the answer rather than any technical force. Any mechanism that asks the owner for an address after a gift is bought tells them a gift was bought. Collecting it when they share the list is the only point in the journey where asking carries no signal. The frozen snapshot on the order then exists so that an owner editing their address next month cannot change where a gift already paid for is going, which would otherwise be a quiet correctness bug in fulfilment.

Option 4 was the closest runner up to Option 2 and was rejected on the handoff, not on the identity count. Deferring anonymous sign in to payment time genuinely reduces the number of user rows, which is the main cost of the chosen option, but it buys that by introducing a bearer identified claim that must later be transferred onto a session identified order. That transfer is a new place a claim can be lost or taken, on the one path where losing it means somebody paid for a gift they do not hold. One identity mechanism that is slightly too generous beats two that must agree.

On the checkout route, a separate page reusing one API was preferred over a mode on the existing page because the two pages genuinely differ in nearly everything visible, no cart, no address form, a recipient projection, gift fields, while they share nearly everything invisible, pricing, variants, order creation, payment, verification. Splitting along that seam puts the duplication where it is cheap and the reuse where it matters. The runner up was extracting a shared checkout engine module out of the route handler first, which is cleaner long term, and was set aside only because refactoring a working GA money path inside a feature that is not about refactoring adds risk to both.

## Evidence: current implementation inventory

Gathered by reading the repository on 2026-09-18. Every claim below was verified in source, not inferred.

**The four authentication gates**

| Gate | Location | Mechanism |
|---|---|---|
| Page | `app/checkout/page.tsx` | `redirect(withRedirect("/login", "/checkout"))` when there is no user |
| API | `app/api/checkout/route.ts` | `getAuthenticatedApiUser`, 401 when absent |
| Database function | `gifvtme_create_checkout_order`, migrations 018 and 025 | `IF auth.uid() IS DISTINCT FROM p_buyer_id THEN RAISE`, plus `GRANT EXECUTE ... TO authenticated` |
| Order reads | `lib/orders/server.ts`, `app/api/orders/[id]/route.ts`, migration 019 policy | `.eq("buyer_id", userId)` and `orders.buyer_id = auth.uid()` |

**What already exists and is reused unchanged**

- `orders.wishlist_item_id` already exists and is already passed through order creation.
- The webhook already sets `wishlist_items.status` and `master_items.status` to `purchased` on a verified payment, and already rejects a payment whose amount or currency does not match the order. **It does this with four independent sequential Supabase REST calls, not a transaction**, each failing with only a `console.error`. So the atomicity this spec requires for the claim transition is new work, not an existing pattern being reused. That is why `gifvtme_confirm_gift_order` is an explicit build task.
- `validateWishlistItem` in the checkout route already refuses `origin != 'catalog'` with a 400 and a non available item with a 409.
- `orders.payment_claimed_at` with a 2 minute stale window already prevents two concurrent Flutterwave sessions for one order.
- `orders.price_changes` already persists the price warning, and `getActivePrice` is already the authoritative price.
- `wishlist_items_with_status` is already granted to `anon` and already gates on `gifvtme_can_read_wishlist_by_id`, so guests can already read item state. Its order join already excludes `pending_payment`, `payment_failed` and `cancelled`, so an unpaid order does not mark an item purchased.

**Authentication and continuation machinery that already exists** (read 2026-09-18, during the revision)

- `components/wishlist/AuthGateSheet.tsx` already renders a sheet offering "Log in" and "Create account", both carrying a `redirect`. It is already wired into `GiverItemActions`. The prompt this revision requires is largely already built.
- `lib/auth/redirect.ts` provides `getSafeRedirect` and `withRedirect`. `getSafeRedirect` rejects anything not starting with `/`, rejects protocol relative and backslash variants including multiply encoded ones, and confirms the resolved origin. Open redirect is already handled.
- `app/(auth)/callback/route.ts` preserves `redirect` through `exchangeCodeForSession`, and preserves it again on failure. The OAuth and email confirmation return path already carries a destination.
- `app/(auth)/signup/page.tsx` and the login page already accept and forward a `redirect` parameter.

So the return journey is already plumbed. What is missing is a trustworthy payload for it to carry.

**The continuation hole this revision closes**

`lib/checkout/pendingWishlistItem.ts` writes `{ wishlistItemId, catalogProductId }` to `localStorage` under `gifvtme.pending-wishlist-item`. `GiverItemActions` sets it, `CheckoutForm` reads it and submits `wishlist_item_id` to `POST /api/checkout`.

It has no signature, no expiry, no single use protection, and it is per browser rather than per session, so it survives signing out and signing in as somebody else. The server side `validateWishlistItem` bounds the damage, requiring the item to be readable, catalogue origin, available, and matching a cart product, but within those bounds the exploit is real: a signed in user can point it at any wishlist item they can read, buy that same catalogue product for themselves, and the webhook will mark **that other person's** wishlist item `purchased`. The gift is marked as bought and nothing arrives.

This is why the revision derives the wishlist association from the caller's own claim rather than from any client input, and why `wishlist_item_id` is removed from the checkout request body entirely.

**What does not exist**

- No claim or reservation record. Only `intent_flagged_by` and `intent_flagged_at` on `wishlist_items`.
- No server side expiry of those flags. `INTENT_FLAG_WINDOW_MS` in `lib/wishlist/shared.ts` and the interval inside the migration 014 RPC both evaluate 24 hours at read time, and nothing ever clears a stale row.
- No trusted continuation. The only mechanism is the `localStorage` one above.
- No guest identity of any kind. Both `gifvtme_flag_wishlist_item_intent` and `POST /api/purchases` require an authenticated user. Under the revised decision this is now correct behavior rather than a gap, and only the 24 hour window, the missing expiry and the two duplicated implementations still need fixing.
- No owner saved delivery destination. `savedAddresses` in `app/checkout/page.tsx` is a hardcoded empty array, and no table carries one.
- No delivery window. `orders.estimated_delivery` is a single date set by operations, not a promised window captured at purchase.

**Known hazards found while reading**

- `orders_idempotency_key_idx` is `UNIQUE (buyer_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. A null `buyer_id` would defeat it, because Postgres treats nulls as distinct in a unique index. Under the revised decision `buyer_id` is always a real account, so this is now a reason to leave the column alone rather than a hazard to design around.
- The `orders` table itself has no migration file in this repository and no visible RLS policies. Migration 019 notes it was created live. This remains the one prerequisite that must be read from the live database, because AC-32 promises those policies are unchanged.
- `handle_new_user` is referenced by migration 012 as existing on `auth.users` with a body that is not checked in. **No longer load bearing** for this spec, since only ordinary signup fires it and ordinary signup already works in production. Still worth checking in for its own sake.
- The scope's 72 hours and the code's 24 hours are in direct conflict, in two separate implementations of the same rule.
- `app/api/occasions/archive` exists as a scheduled endpoint but is absent from `vercel.json`.
