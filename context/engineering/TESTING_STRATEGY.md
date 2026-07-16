# Gifvtme — Testing Strategy

No automated test suite exists as of this writing. Given the solo-developer, 4-month timeline (see `PROJECT_OVERVIEW.md`), this is an accepted tradeoff for v1, not an oversight — but it means manual verification discipline matters more than usual, especially around the areas listed below.

## If automated tests are introduced, prioritize in this order

1. **Duplicate purchase prevention** — verify the `one_purchase_per_item` constraint actually blocks a second purchase attempt, and that application code handles the resulting database error gracefully rather than crashing (see `ERROR_HANDLING.md`).
2. **Price snapshotting** — verify that changing a Sanity product's price after an order exists does not alter `order_items.unit_price` on that historical order (business rule #7).
3. **Flutterwave webhook signature verification** — verify an unsigned/incorrectly-signed webhook payload is rejected and never flips an order to `confirmed`.
4. **RLS policy correctness** — verify a user genuinely cannot read another user's orders, wishlists (when private), or reminders via direct Supabase queries, not just through the UI.
5. **Review verified-purchase gating** — verify a user without a completed order for a product cannot submit a review for it.

## Manual QA checklist (use until automated tests exist)

Before any deploy touching purchase, checkout, or order logic, manually walk through:

- Create a wishlist, add an external item via scrape, add one via manual entry fallback.
- Share the wishlist at each visibility tier and confirm access matches expectations (private/friends-family/public) from a logged-out or different-account browser session.
- Mark an external item as purchased, confirm it shows claimed on the wishlist and a thank-you message record exists.
- Attempt to "buy" an already-claimed item and confirm the UI prevents it.
- Add a catalog item to cart, complete a test Flutterwave payment (sandbox mode), confirm an order is created with the correct snapshotted price.
- Check that the order shows up correctly in Retool and that a manual status change logs to `order_status_history`.

## What not to over-invest in for v1

End-to-end browser automation (Playwright/Cypress) and broad unit test coverage across UI components are not worth building yet given the timeline — focus any testing effort on the data-integrity and money-related paths listed above, since those are the highest-cost-of-failure areas.
