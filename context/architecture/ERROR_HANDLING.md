# Gifvtme — Error Handling

## URL scraping failure (Microlink)

When `/api/scrape` returns a 422, the wishlist item creation UI must fall back to manual entry — a form with title, image upload, and price fields — rather than blocking the user. Never present scraping as the *only* way to add an external item; see `THIRD_PARTY_INTEGRATIONS.md` for why this happens (bot-blocking, JS-heavy sites).

## Flutterwave payment failure vs timeout

**Failure** (Flutterwave actively reports the payment failed): the webhook handler sets `orders.status = 'payment_failed'`. The checkout UI should show a clear retry path — let the user attempt payment again rather than abandoning the order silently.

**Timeout / abandoned** (user closes the tab mid-payment, no webhook ever arrives): the order remains `pending_payment` indefinitely. This is an acceptable state in v1 — there is no scheduled cleanup job for stale pending orders, but consider whether one is needed before launch (flag in `ROADMAP.md` if not yet decided). Do not write code that assumes every order eventually resolves to a terminal status.

**Never trust the client-side redirect alone.** A user being redirected back to a "success" URL from Flutterwave is not proof of payment — only the verified webhook (or a server-side status check against Flutterwave's API) should ever flip `orders.status` to `confirmed`.

## Duplicate purchase attempts

The database enforces this at the constraint level (`one_purchase_per_item` on `purchases.wishlist_item_id`) — this is the actual safety net, not a UI check. Application code should still try to prevent the attempt at the UI level for good UX (disable the "Buy this gift" button once `wishlist_items.status = 'purchased'`), but if a race condition causes two simultaneous attempts, the database insert will fail for the second one — handle this gracefully (catch the constraint violation, show "someone just claimed this" rather than a raw database error).

## Catalog item with a stale/changed Sanity price

Because `order_items.unit_price` is snapshotted at purchase time (business rule #7), there is no "price changed after you added to cart" error state for completed orders. However, **while an item sits in an unconverted cart** (before checkout), the displayed price should reflect the current Sanity price — if a flash sale ends or a price changes while something sits in a user's cart, show the updated price at checkout time, not whatever was shown when it was added.

## Flash sale edge cases

If a flash sale's end time passes while a user is actively viewing a product page or has it in their cart, the price shown should update to the regular price on next render/checkout — there is no "honor the sale price because they had it in their cart" grace period (business rule #9). This should be communicated gently in the UI (e.g. "this flash sale has ended" rather than a silent price jump with no explanation) but the underlying price logic is strict.

## Reminder send failures

Not yet relevant since the actual Resend send call isn't implemented yet (see `THIRD_PARTY_INTEGRATIONS.md`) — but when it is, a failed send should not mark the `reminders.sent` flag as true. The reminder should remain eligible for retry on the next cron run rather than being silently lost.

## Review submission without a verified purchase

The `/api/reviews` route should reject (403 or similar) any attempt to review a product the user hasn't purchased, with a clear message — not a generic validation error. This check happens in route-handler code, not solely via RLS, since "verified purchase" requires a join across `orders`/`order_items` that's more naturally expressed in application logic (see `API_ROUTES.md`).

## General API error response shape

Every API route should return `{ error: string }` on failure with an appropriate HTTP status — 400 for bad input, 401 for missing/invalid auth, 403 for an authenticated-but-not-permitted action, 422 for a valid request that failed for an external reason (e.g. scraping failure), 500 only for genuinely unexpected server errors. Never return a bare empty 500 with no error body — the frontend needs something to show the user.

Wishlist owner checks are the privacy exception: if an authenticated user references a missing or non-owned wishlist ID, return `{ error: "Wishlist not found." }` with 404 rather than 403 so the API does not disclose whether another user's wishlist exists.
