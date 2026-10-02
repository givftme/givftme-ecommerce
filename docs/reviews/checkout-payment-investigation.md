# Checkout and Flutterwave investigation

## Current investigation, 2 October 2026

The payment initialization failure is now localized and fixed. The request's
customizations.description was Order #<first eight order ID characters>.
Flutterwave's Cloudflare security layer rejected that request with HTTP 403.
Changing only the description to Order <first eight order ID characters>
returned HTTP 200, JSON status success, and a hosted payment link. The precise
Cloudflare rule remains unknown, but the blocking payload field is proven.
A second failure was then reproduced in retry: Flutterwave's test API returns
links on checkout-v2.dev-flutterwave.com, while the allowlist accepted only
checkout.flutterwave.com. The shared allowlist now accepts that exact test
host with the existing HTTPS and hosted payment path checks.

You also reported that Flutterwave does not accept localhost as the webhook
URL. A public tunnel can deliver webhooks to the local application. Your later
browser attempt reached POST /api/checkout and returned HTTP 502; its saved
server diagnostic confirms the provider's HTTP 403 for the order below.

The earlier optional shipping validation fix was already in the working tree
when this investigation started. It was preserved and verified again.

### Current flow

The implementation map and identifier tables in the earlier investigation
below still describe the source. This is the catalog flow only. External
wishlist items use purchase marking and affiliate redirects instead.

CheckoutForm or GiftCheckoutForm validates the form, sends JSON and an
Idempotency-Key to POST /api/checkout, and waits for order_id and payment_link.
The handler authenticates the buyer, validates the payload, retrieves catalog
products from Sanity, calculates prices on the server, and creates the order
and its items through gifvtme_create_checkout_order. Gift orders bind to an
active catalog reservation on the server.

The initializer generates gifvtme_order_<order UUID>_<attempt UUID> and POSTs
to https://api.flutterwave.com/v3/payments. It sends the total in Naira, NGN,
the selected payment option, synthetic or buyer contact fields using
phonenumber, meta.order_id, and a redirect URL ending in
/checkout/processing?order=<order UUID>. The browser assigns the returned link,
after any required price confirmation. Initial checkout does not apply the
payment link allowlist, while retry does.

Processing reads only order and polls Supabase every two seconds for up to
three minutes. It ignores status, tx_ref, and transaction_id from the provider
redirect. Neither processing nor the webhook calls the provider transaction
verification API. Confirmation depends on the charge.completed webhook,
verif-hash validation, matching amount and currency, and the confirmation RPC.

The transaction reference parser round trips a generated reference to its
order UUID. A retry reuses the order and stored amount with a new reference.
The reference and link are not stored when initialization succeeds. The
payment claim prevents concurrent initialization for two minutes, rather than
preventing two hosted sessions from remaining payable.

### Failure point and evidence

| Observation | Result |
| --- | --- |
| Required local environment variables | Secret key, secret hash, app URL, Supabase public keys and service key are present. Values were not printed. |
| Local app origin | Valid HTTP localhost origin, without an extra path, query, or fragment. |
| Provider key mode | Test mode. Synthetic probes were guarded to stop if a test key was absent. |
| Read only GET /v3/banks/NG | HTTP 200, status success, message Banks fetched successfully. Credentials are accepted by that endpoint. |
| Actual initializer, synthetic customer, amount 25000, NGN, card | POST https://api.flutterwave.com/v3/payments returned HTTP 403. Content type text/html; charset=UTF-8. Server cloudflare. |
| Rejection body | Title Attention Required! \| Cloudflare, heading Sorry, you have been blocked, text You are unable to access flutterwave.com. No customer data or full HTML was retained in this report. |
| Flutterwave response status/message | Absent. This was a Cloudflare HTML block page, not a Flutterwave JSON error. |
| data.link | Absent. Initializer returned ok false. No link was available to validate or send to the browser. |
| Public origin experiment | Changing only NEXT_APP_URL to https://www.givftme.com in the diagnostic process still returned HTTP 403 and the same Cloudflare block. Saved environment files were untouched. |
| Empty request experiment | An empty JSON body reached Flutterwave validation and returned HTTP 400 with JSON status error. This refutes a block on every POST to the endpoint. |
| Description experiment | The original complete synthetic payload returned HTTP 403. Reusing the same endpoint, headers, reference, amount, customer, metadata, and URLs, and removing only # from customizations.description returned HTTP 200, JSON status success, message Hosted Link, and data.link. |
| Description reversal | A later fixed request returned HTTP 200. Restoring only # in its description returned HTTP 403 with the Cloudflare block again. |
| Actual helper after description fix | A fresh reference returned HTTP 200 and data.link. Amount 30000, NGN, meta.order_id, and parsed tx_ref order association were preserved. |
| Test hosted link | HTTPS, hostname checkout-v2.dev-flutterwave.com, path /v3/hosted/pay/<token>, no query, port, or credentials. The old allowlist rejected it. |
| Retry reproduction | With a mocked successful provider response using that observed test host, reinitiateOrderPayment still returned the generic HTTP 502 before the allowlist fix. |
| Public webhook reachability | POST https://www.givftme.com/api/flutterwave/webhook with an empty JSON object and no hash returned HTTP 401 without a redirect. No valid event or secret was sent. |
| Current browser attempt | New serialized diagnostic identifies order 79b877da-46ce-4904-b12f-80c5b0138025, HTTP 403, HTML, server cloudflare, no provider status/message, and no payment link. The route then returned the reported HTTP 502. |

The provider request used the source implementation with synthetic contact
details and a generated order UUID that does not exist in Supabase. No payment
was completed, no production order was created or changed, and no valid
webhook was sent. The description experiment created an unpaid test hosted
session after the original description was removed.

The literal endpoint, phonenumber field, and request shape agree with
[Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1).
card, banktransfer, and ussd are documented for NGN in
[payment methods](https://developer.flutterwave.com/docs/payment-methods).
The provider account's enabled methods and saved webhook URL/hash cannot be
inspected with the available tools. Acceptance of the key by the banks
endpoint does not establish that the payments endpoint will accept a request.

The exact test host also appears in Flutterwave's official
[Zambia Mobile Money documentation](https://developer.flutterwave.com/docs/zambia-mobile-money).
That page describes a different payment path. The authenticated Standard API
response supplies the direct evidence for this hosted checkout URL.

### Database state

A read only query first retrieved five recent orders without contact or
address fields. A later query read the exact order identified by the new
diagnostic for your failed browser attempt:

| Field | Value |
| --- | --- |
| id | 79b877da-46ce-4904-b12f-80c5b0138025 |
| created_at | 2 October 2026, 15:06:35 WAT |
| order_source | self |
| status | pending_payment |
| total_amount | 30000 |
| currency | NGN |
| flutterwave_tx_ref | null |
| flutterwave_tx_id | null |
| payment_claimed_at | null |
| confirmed | No |

The order exists, is unconfirmed, and has its payment claim released. The
matching server diagnostic proves that its initialization returned HTTP 403
without a hosted link. The source places initialization after successful
execution of the order creation RPC; no direct live RPC trace was captured.

### Root cause

The initializer's Order #<short ID> description triggers the observed
Cloudflare rejection. The application converts that failed initialization to
the generic HTTP 502 response you saw. The controlled experiment changed only
the description and received a hosted link. No credentials, price, customer
field, payment method, endpoint, or webhook change was needed for that request
to succeed. The exact provider security rule was not inspected.

The retry path had a second cause: its shared link allowlist rejected the
actual test checkout hostname. A pending order replay or explicit retry would
therefore still return HTTP 502 even after successful initialization. The
same helper is used by PaymentFailedScreen before browser navigation.

Local webhook delivery has its own cause: Flutterwave's servers need a public
endpoint and cannot reach this machine through localhost. Even if a hosted
checkout opens, the present processing screen cannot confirm the order unless
the correct application instance receives and persists its webhook.

### Required fix

For a deployed test, the reachable public webhook is
https://www.givftme.com/api/flutterwave/webhook. The Flutterwave test dashboard
must point there and its custom hash must match FLUTTERWAVE_SECRET_HASH on that
deployment. Reachability alone does not prove that the dashboard is configured
or that the deployed code matches the working tree.

For a local test, use a public HTTPS tunnel to the local Next.js server and
configure the test webhook as <tunnel origin>/api/flutterwave/webhook. Browsing
localhost and keeping NEXT_APP_URL=http://localhost:3000 preserves the existing
browser session for the return redirect. Moving the entire app to a tunnel
origin is optional and needs its own authentication redirect configuration.
Pointing at production exercises the deployed handler rather than local changes.

The minimal application fix removes # from customizations.description in
lib/flutterwave/index.ts. Checkout and retry share this initializer, so both
receive the correction. lib/flutterwave/paymentLink.ts also accepts the exact
provider test hostname for retry and its client screen. No wildcard was added.
The rest of the request stays unchanged. No dashboard
settings, deployment settings, or network configuration were changed during
this investigation.

### Diagnostic changes and verification

lib/flutterwave/index.ts now emits one serialized server log entry containing
orderId, tx_ref, HTTP status, content type, response server, response format,
provider status/message, and whether a link exists. Secret key/hash, known
customer values, and a returned hosted link are redacted from diagnostic text
and the returned internal error that callers log. Unexpected status objects
are omitted. The request body, raw response, and full hosted link are excluded
from the new diagnostic. Using one string retains
fields in the development log that previously recorded only an empty object.
Payment requests, browser responses, redirects, and order transitions are
unchanged except for the one description character. Internal provider error
text now redacts those sensitive values.

lib/flutterwave/index.test.ts adds four diagnostic regression cases for an HTML 403,
secret/contact redaction, successful link handling, and unexpected status
objects. The first three failed before the diagnostic was added and pass
after it. A fifth case models the observed provider rejection of Order #
descriptions. It failed before the description fix. The earlier validation reproduction was
also repeated without changing files: HEAD rejects omitted apartment,
postal_code, and delivery_instructions; the working tree schema accepts them.

lib/flutterwave/paymentLink.test.ts covers both production and test links,
while rejecting HTTP, other paths, other test subdomains, domain suffix
spoofs, and deceptive username/hostname URLs. A regression in
lib/checkout/reinitiatePayment.test.ts proves a pending order can reuse its
stored amount and accept the test link. Both test host acceptance cases
failed before the allowlist correction.

Final verification passes 71 focused tests across seven files, focused ESLint,
and git diff --check. The real reinitiateOrderPayment and
initiateFlutterwavePayment helpers were then run against the real Flutterwave
test API with a fresh synthetic order and an in memory database claim. They
returned HTTP 200, ok true, and an accepted hosted link on
checkout-v2.dev-flutterwave.com. The corrected description, tx_ref order
association, meta.order_id, amount 30000, and NGN were verified. There was one
simulated claim and no actual database call or completed payment.

The browser's failed initialization is now observed. An actual completed
payment, webhook signature match, and successful confirmation RPC execution
remain unobserved. These still need a working public test setup.

### Additional issues, separate from initialization

1. Processing relies solely on webhook persistence. The webhook does not
   independently verify transactions. Flutterwave recommends checking status,
   amount, currency, and reference through its
   [verification API](https://developer.flutterwave.com/docs/transaction-verification).
2. Webhook lookup and RPC failures return HTTP 200. That acknowledges delivery
   even if the order update failed, removing the provider's retry signal.
   See [webhook retries](https://developer.flutterwave.com/docs/webhooks).
3. The source webhook accepts success after payment_failed, and migration 027
   directly confirms it, but migration 021's transition guard forbids
   payment_failed to confirmed. If the shipped trigger is installed, that
   sequence rolls back and is then acknowledged with HTTP 200. The live
   trigger definition was not read. Mocked RPC tests do not exercise it.
4. The failure RPC retains payment_claimed_at. A decline during the first two
   minutes can block immediate retry with HTTP 409. References and links are
   not persisted at initialization, so a later retry can create another
   payable hosted session.
5. Initial checkout omits the payment link allowlist. Retry checks it.
6. Migration 027 grants service access to SECURITY DEFINER confirmation/failure
   RPCs but does not revoke PUBLIC execution. Default Postgres privileges
   therefore do not establish the intended boundary. Actual live ACLs and
   default privileges remain unknown. See
   [Supabase function privileges](https://supabase.com/docs/guides/database/functions#function-privileges).
7. Order creation accepts totals and line prices as RPC arguments. The API
   recomputes them, but direct authenticated RPC callers may bypass that
   calculation unless a live database guard prevents it. Base orders RLS and
   constraints are absent from the migration history, so this was not tested
   by attempting a purchase or altering data.
8. Gift claim lookup picks the newest caller reservation for a product ID.
   Reserving the same catalog product on two wishlists can make the selected
   gift ambiguous. This is outside the self checkout initialization failure.

### Files that need modification

The observed Cloudflare block has a proven application fix: remove the hash
character from the hosted checkout description. The test link rejection also
has a proven fix: add only the observed, documented test hostname. Current
new edits are limited to lib/flutterwave/index.ts, lib/flutterwave/index.test.ts,
lib/flutterwave/paymentLink.ts, lib/flutterwave/paymentLink.test.ts,
lib/checkout/reinitiatePayment.test.ts, and this report.

If the separate confirmation work is approved, relevant surfaces are
app/checkout/processing/page.tsx and components/order/ProcessingScreen.tsx for
redirect verification; app/api/flutterwave/webhook/route.ts and a shared
verification helper under lib/flutterwave for verified confirmation and error
acknowledgement; lib/checkout/reinitiatePayment.ts and the checkout route for
attempt persistence and safe link handling; and a new numbered SQL migration
for any confirmed transition, claim, or function privilege correction.
Those changes have not been made. Existing migrations and production data
were preserved. Money and access rules need verification before that work.

## Earlier investigation, 30 September 2026

Investigation date: 2026-09-30.

The reported symptom is `Check your checkout details and try again.`
after clicking `Place order` on `/checkout` on localhost.

Root cause reproduced and fixed: blank optional shipping fields are normalized
to undefined, then omitted by JSON.stringify. The API schema allowed an
explicit undefined value but rejected an absent object key. It returned HTTP
400 before product lookup, order creation, or Flutterwave initialization.

Affected fields: shipping.apartment, shipping.postal_code, and
shipping.delivery_instructions. A single blank field can trigger the error.

The minimal fix adds .optional() to optionalTrimmedString in
lib/checkout/validation.ts. Blank and omitted fields now remain valid across
the browser to API JSON boundary. Payment behavior is unchanged.

## Implementation map recorded before the fix

| Stage | Implementation | Data and behavior |
| --- | --- | --- |
| Page access | app/checkout/page.tsx, lib/supabase/server.ts | Cookie session, auth.getUser(), redirect to login when absent. Prefills account contact details. |
| Cart | components/cart/CartContext.tsx | Reads gifvtme.catalog-cart from localStorage. Accepts any JSON array as CartItem[] without validating entries. |
| Price refresh | components/cart/useCartPriceRefresh.ts, app/api/cart/prices/route.ts, lib/sanity/queries.ts | Fetches catalog products, checks availability, updates displayed prices. Does not normalize stored quantity or combination key. |
| Self checkout | components/checkout/CheckoutForm.tsx | React Hook Form validates shipping with checkoutFormSchema. Then checkoutSchema.safeParse validates shipping plus cart. Rejection here shows the reported message and returns before generating an idempotency key or calling fetch. |
| Gift checkout | components/checkout/GiftCheckoutForm.tsx, app/w/[id]/gift/[itemId]/checkout/page.tsx | Validates buyer contact, submits one catalog item at quantity one with order_source: wishlist. Page requires a reservation and excludes external items. Recipient address does not reach the form. |
| Payment selection | components/checkout/PaymentMethodSelector.tsx | Values are card, banktransfer, ussd. Self form writes to form state. Gift form uses separate preference state. |
| Request | Both checkout forms | POST JSON to /api/checkout with Idempotency-Key. Receive order_id, payment_link, and price warning. |
| API validation | app/api/checkout/route.ts, lib/checkout/validation.ts | Authenticates, requires header, selects self or gift schema. Failure returns HTTP 400 with the same message before reading orders or calling Sanity. |
| Existing order | app/api/checkout/route.ts | Looks up buyer_id and idempotency_key. A resolved order returns its ID with no link. Pending or failed orders use the retry helper with the stored amount. |
| Gift binding | lib/gift/server.ts, migration 027 | Resolves caller's active catalog claim and takes its checkout hold. External purchase marking is separate in /api/purchases. |
| Product and price validation | app/api/checkout/route.ts, lib/flutterwave/getActivePrice.ts, CART_PRICES_QUERY | Requires active products and available selected variants. Computes unit prices and sums quantity times unit_price. display_price only drives the price warning. Existing five minute sale grace is unchanged. |
| Order creation | gifvtme_create_checkout_order, migration 027 | One transaction inserts orders and order_items, sets pending_payment and payment_claimed_at = now(), saves price_changes, returns UUID. Duplicate key recovery reads the winning committed order. |
| Initialization | lib/flutterwave/index.ts | Requires NEXT_APP_URL and FLUTTERWAVE_SECRET_KEY, generates a unique reference, POSTs to literal https://api.flutterwave.com/v3/payments with a 15 second timeout. |
| Provider response | lib/flutterwave/index.ts, checkout route | Requires HTTP success, JSON status: success, and data.link. Failures log provider error on server, release the claim, return generic HTTP 502. |
| Browser redirect | Both checkout forms | window.location.assign(payment_link). Price warning pauses for buyer confirmation. Initial checkout does not apply the link allowlist. |
| Processing | app/checkout/processing/page.tsx, components/order/ProcessingScreen.tsx | Reads only order. Polls Supabase every two seconds for three minutes. confirmed routes to order; payment_failed routes to failure screen. Redirect transaction_id, tx_ref, and status are ignored. |
| Webhook | app/api/flutterwave/webhook/route.ts | Checks verif-hash against FLUTTERWAVE_SECRET_HASH, accepts charge.completed, resolves order UUID from metadata or reference. Successful event must match amount and currency. No provider transaction verification API call. |
| Confirmation | gifvtme_confirm_gift_order, migration 027 | Locks order, records flutterwave_tx_id and flutterwave_tx_ref, confirms it, updates valid gift claim and wishlist/master item in one transaction. Moved claim records fulfilment conflict. |
| Failure | gifvtme_fail_gift_order, migration 027 | Sets payment_failed, records transaction ID, restores or expires gift reservation. Does not clear payment_claimed_at. |
| Retry | app/checkout/failed/page.tsx, components/order/PaymentFailedScreen.tsx, app/api/checkout/retry/route.ts, lib/checkout/reinitiatePayment.ts | Authenticates and validates UUID and buyer ownership. Reclaims pending/failed order only when claim is empty or older than two minutes. Stored amount/contact, new reference. Helper and failure screen apply link allowlist. |

## Identifiers and amounts

| Value | Origin and lifetime |
| --- | --- |
| Order ID | Database UUID returned by RPC. Used in response, provider metadata, redirect, polling, retry, webhook. Route casts RPC result to string without runtime UUID validation. |
| Idempotency key | Self form retains key for normalized cart and shipping signature in React state. Preference is excluded. Gift form retains one key for component lifetime. Uniqueness is per buyer and key. Reloading loses form state. |
| Total amount | Server sum of current catalog prices times quantities in Naira, stored as numeric. Retry reuses stored amount. No kobo conversion for initialization. Webhook compares amounts rounded to hundredths. |
| Currency | Initial checkout and provider payload use NGN. Retry rejects other currencies. |
| Preferred payment | Forwarded as payment_options, not saved on order. Explicit retry omits preference and enables card,banktransfer,ussd. |
| tx_ref | gifvtme_order_<order UUID>_<random UUID> for each attempt. Not persisted at initialization. Stored on successful webhook confirmation. Parser also accepts legacy bare order UUID. |
| Transaction ID | Webhook data.id stored as text. Browser redirect transaction_id is ignored. |
| Status | Starts pending_payment. Webhook success confirms pending or failed orders. Failure acts on pending orders. Retry can return failed orders to pending. |
| payment_claimed_at | Set at creation/retry, released on initialization failure. Retained after link generation and webhook. Older than two minutes can be reclaimed. Limits concurrent initialization, not lifetime of hosted sessions. |

## Initialization payload

This is the source contract, not a captured request from the failing browser.
Identifiers, customer fields, application origin, and authorization are redacted.

```json
{
  "tx_ref": "gifvtme_order_<order UUID>_<attempt UUID>",
  "amount": "<server computed number in Naira>",
  "currency": "NGN",
  "redirect_url": "<NEXT_APP_URL>/checkout/processing?order=<order UUID>",
  "meta": { "order_id": "<order UUID>" },
  "customer": {
    "email": "<redacted>",
    "name": "<redacted>",
    "phonenumber": "<redacted>"
  },
  "customizations": {
    "title": "Gifvtme",
    "description": "Order #<first eight order ID characters>",
    "logo": "<NEXT_APP_URL>/logo.png"
  },
  "payment_options": "<selected method, or card,banktransfer,ussd>"
}
```

Authorization is a server secret bearer token. Its value was not printed.
The source URL has no Markdown syntax.

## Evidence and limits

1. The reported error is emitted only by browser complete payload validation
   and API body validation. Neither rejection path calls Flutterwave.
2. Synthetic input with blank optional shipping fields passed both browser
   parses. Serializing the parsed result omitted those keys. Revalidating the
   JSON failed with invalid_type, expected nonoptional, at all three optional
   field paths. Filling all three fields made the same experiment pass.
   Malformed cart state was not the cause of this reproduced failure.
3. Local loading via @next/env confirms nonempty FLUTTERWAVE_SECRET_KEY,
   FLUTTERWAVE_SECRET_HASH, Supabase URL, anon key, and service role key.
   Values were not printed. Presence does not prove provider credentials valid.
4. getAppUrl() reads NEXT_APP_URL, not NEXT_PUBLIC_APP_URL. The local value is
   a valid HTTP localhost origin without extra path or query. Dashboard webhook
   configuration has not been inspected.
5. Available .next/dev/logs/next-development.log contained no checkout POST
   lines or Flutterwave messages at inspection. This does not establish that
   no request occurred elsewhere.
6. Baseline command: npm test -- lib/checkout lib/flutterwave app/api/checkout
   app/api/flutterwave. All original 54 tests passed. Four new regression
   cases failed before the fix, including an API test that returned HTTP 400
   with the reported message. With the fix, all 58 tests across five files pass.
   The API regression now creates an order and returns its payment link with
   mocked services. No live order or Flutterwave session was created.
   Existing tests submitted raw blank strings, so they missed the browser's
   normalization followed by JSON serialization.
7. No failing browser payload or authenticated session was captured. Provider
   HTTP status, status/message, data.link, browser receipt, and actual redirect
   execution are unobserved for this failure. There is no actual Flutterwave
   error to report yet.
8. A read of the configured Supabase OpenAPI schema returned HTTP 200.
   Required checkout columns exist, including UUID id, numeric total_amount,
   idempotency_key, payment_claimed_at, flutterwave_tx_id, flutterwave_tx_ref,
   price_changes, and gift fields. The 21 argument create RPC and both
   confirmation/failure RPC signatures exist. Nullable address columns match
   gift checkout needs. This proves schema exposure, not authenticated RLS
   behavior or successful transaction execution.
9. Base orders creation is absent from repository migrations. Migration 017
   records it was created live; its DATABASE_SCHEMA.md reference is absent.
   Complete database constraints and row policies were not independently read.
10. Focused ESLint and git diff --check passed. Repository type checking was
    blocked by the existing components/layout/Navbar.test.ts, whose 1370 bytes
    are all NUL characters. That unrelated tracked file was not modified.

## Separate downstream findings

These findings do not explain the reported validation message.

1. Initial checkout omits isAllowedFlutterwavePaymentLink(). Retry helper and
   failure screen apply it. It requires HTTPS, checkout.flutterwave.com,
   and a path starting /v3/hosted/pay/.
2. Processing only polls Supabase; webhook does not query provider verification.
   Flutterwave recommends verifying transaction status, reference, currency,
   and amount before confirming value.
   See [transaction verification](https://developer.flutterwave.com/docs/transaction-verification).
3. Webhook database lookup and update failures return HTTP 200, acknowledging
   delivery even when the state update fails. Processing has no recovery path.
   See [webhook acknowledgement and retries](https://developer.flutterwave.com/docs/webhooks).
4. Attempt reference and link are not stored at initialization. After the
   two minute claim window, another hosted session can be created for the same
   order. Database idempotency alone does not prevent paying two sessions.

## Initialization trace for the reproduced failure

| Check | Evidence |
| --- | --- |
| Form and complete browser payload validate | Both pass with blank optional fields. |
| POST /api/checkout | Direct handler regression reproduces HTTP 400 after JSON serialization. |
| Authentication and idempotency header | Pass in the controlled handler test; authentication is mocked. |
| Order body validation | Fails before the fix with absent optional shipping keys. |
| Catalog validation, server pricing, order RPC | Not reached in the failing reproduction. Reached with mocked services after the fix. |
| Flutterwave initialization | Not reached in the failing reproduction. Mock invoked after the fix. |
| Request URL | Source uses exactly https://api.flutterwave.com/v3/payments, with no Markdown syntax. |
| Server secret presence | Confirmed locally, without displaying the value. |
| Provider HTTP status, status, message, data.link | No live provider response exists for the reproduced validation failure. |
| Allowlist | Initial path does not apply it; retry does. No real link captured. |
| Browser receives payment_link and location.assign executes | Code mapped; authenticated browser retest remains outstanding. |

The example request contract agrees with the documented
[Flutterwave Standard endpoint](https://developer.flutterwave.com/reference/checkout).
The three payment preference values are documented for NGN in
[Flutterwave payment methods](https://developer.flutterwave.com/docs/payment-methods).
Provider dashboard settings can override method selection; those settings were
not inspected.

## Local login blocker reported during retest

The user then reported that Google login returned to the local homepage with a
code query parameter. The code itself is intentionally not recorded.

The application requests /callback from GoogleOAuthButton. Only
app/(auth)/callback/route.ts exchanges that code for a session. app/page.tsx
does not exchange codes. Returning to / instead of /callback therefore skips
the session handoff. The normal application fallback after successful login
is /wishlists, not /.

The local /login page and Supabase public auth settings both returned HTTP 200.
Email and Google providers are enabled. The browser log records Google login
completion before the OAuth round trip has completed, so that event does not
prove that a session was established.

A fresh isolated Chrome profile clicked Google login on
http://localhost:3000/login?redirect=/checkout. The actual browser request used
provider google, PKCE, and redirect_to equal to
http://localhost:3000/callback?redirect=%2Fcheckout. It contacted Supabase project
kfhufngnaibunciudkmp, matching the local environment. The browser stopped before
any account login. No customer session or login code was used.

The user supplied the saved Redirect URLs from the active project's settings:
https://givftme.com/, https://www.givftme.com/, and http://localhost:3000/.
The local entry covers only the homepage, not /callback. The recommended
http://localhost:3000/** entry was absent despite an earlier report that it had
been added. This confirms the configuration mismatch behind the local login
failure. Add that wildcard as a separate Redirect URLs entry, save it, and
start a fresh Google login. The user subsequently confirmed that local login now works.

Controlled OAuth flows were started and immediately cancelled, with the same
localhost Referer header a browser sends. After the reported settings change,
the live service returned these results:

| Requested return URL | Actual return URL without error parameters | Response |
| --- | --- | --- |
| https://www.givftme.com/callback | https://www.givftme.com/callback | 302, deliberate access_denied |
| http://localhost:3000/callback | http://localhost:3000/ | 302, deliberate access_denied |
| http://localhost:3000/callback?redirect=%2Fcheckout | http://localhost:3000/ | 302, deliberate access_denied |

The production callback is a positive control: the probe preserves an accepted
path. The local callback is still rejected by the active service. Its health
endpoint reports GoTrue v2.197.0. In that version,
[GetReferrer](https://github.com/supabase/auth/blob/v2.197.0/internal/utilities/request.go)
checks redirect_to against the allowed destinations, then tries the Referer
header, then falls back to Site URL. This explains why the browser's localhost
root Referer can become the return destination when the callback is disallowed.

The requested callback in app code and in the running browser is correct.
The saved localhost allowlist entry is too narrow, which agrees with the live
service's fallback behavior. No authentication code workaround has been added.

See [the active project's URL Configuration](https://supabase.com/dashboard/project/kfhufngnaibunciudkmp/auth/url-configuration)
and [Supabase redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).
The documented local development allowlist pattern is http://localhost:3000/**.
The agent cannot inspect or edit the project's dashboard settings with the
available tools. Existing callback and redirect tests passed: 16 tests across
two files.

## Final changes

The checkout changes are limited to the optional shipping schema and four
regression cases. Temporary field/code diagnostics were removed after
reproduction. A later navbar followup also makes the existing account button
visible on mobile. The payment implementation, database, and authentication
code are unchanged.

The user confirmed that local login now works after correcting the redirect
configuration. Checkout still needs a live retest to observe the provider
response and complete browser and webhook verification.

## Navbar followup

The user reported that Get started should be replaced by profile and cart
buttons after login. The user confirmed that /account still redirects to login,
so the current guest navbar reflects an absent session. A repeat controlled
Supabase probe still returned the localhost homepage instead of /callback.

Rendering the existing Navbar with isAuthenticated true already removes
Get started and includes account and cart links. The profile link was hidden
below the medium breakpoint. Its display classes now make it visible at mobile
sizes too, with a 40 pixel mobile target and the existing 44 pixel desktop target.
No session detection or authorization behavior was changed.

Local render checks passed for both guest and authenticated states, including
the login return path and mobile profile visibility. Focused ESLint returned
no errors and two existing unused import warnings. git diff --check passed.
The user subsequently confirmed that local login now works. A live checkout
retest remains outstanding.
