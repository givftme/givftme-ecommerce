# Givftme — Business Rules

This file lists hard invariants. Unlike `PRD.md`, which explains reasoning, this file is meant to be checked mechanically: before changing purchase, pricing, auth, or order logic, scan this list and verify nothing here is being broken.

## Purchases & duplication

1. **An item can only be purchased once.** Enforced at the database level via the `one_purchase_per_item` unique constraint on `purchases.wishlist_item_id`. Application code must treat a second purchase attempt on the same item as an error state, not silently allow it, even if the UI hasn't refreshed yet.
2. **A user must have a Givftme account before marking any wishlist item as purchased**, regardless of whether the item is external or catalog origin. This is required to support the thank-you message system — there is no anonymous purchase-marking path.
3. **Marking an external item "purchased" never involves Givftme processing any payment.** The `purchases` table only records that a redirect happened and the user confirmed completion — it is not a financial transaction record.

## Item origin (external vs catalog)

4. **Every `wishlist_items` row must have `origin` set to either `external` or `catalog`, never null, never anything else.**
5. **If `origin = 'external'`, `product_url` must be present.** If `origin = 'catalog'`, `catalog_product_id` (a Sanity document ID) must be present. These are enforced by database check constraints — do not write code that could violate them.
6. **External items and catalog items must never be combined in a single cart or checkout.** A customer with both types of items in mind completes two separate flows.

## Pricing

7. **The price a customer is charged for a catalog item is permanently snapshotted into `order_items.unit_price` at the time of purchase.** This value must never be recalculated from the current Sanity product price after the fact, even if the Sanity price changes later (sale ends, price increases, etc.). The order record reflects what was actually paid, full stop.
8. **`order_items.total_price` is a generated column (`quantity * unit_price`)** — never write application code that calculates and stores this separately; let the database compute it.
9. **Flash sale prices apply only within the sale's active time window.** Once a flash sale's `endTime` has passed, the regular price applies immediately — there is no grace period and no need for a cron job to "turn off" the sale; the active-sale check is always time-based at read time.

## Orders & fulfillment

10. **Orders for catalog items are never auto-forwarded to suppliers.** A human on the internal team must review and manually change status before any fulfillment action is implied. Do not build or enable any code path that automatically contacts a supplier API in v1.
11. **Every order status change must be logged to `order_status_history`.** This happens automatically via the `on_order_status_changed` trigger — do not bypass this by updating `orders.status` through any path that skips the trigger (e.g. raw SQL that disables triggers).
12. **Customers can only see their own orders and their own order status history.** Enforced via RLS — do not write a query path (e.g. a service-role query exposed to the client) that bypasses this.

## Reviews

13. **A user may only leave a review for a catalog product if they have a completed order containing that product.** This must be checked against the `orders`/`order_items` tables, not merely against whether they're logged in.
14. **A user may leave at most one review per product.**

## Gift pooling

15. **Gift pooling is a distinct, live payment flow.** Use `group_gift_pools`, `pool_contributions`, and `pool_payouts`; never put pool contributions in `purchases`, `orders`, or the catalog cart.
16. **A pool contribution requires an authenticated account and an immediate Flutterwave payment in NGN.** There is no pledge mode, wallet, or stored customer balance.
17. **Pool capacity is reserved and confirmed atomically in Postgres.** A webhook must verify Flutterwave's signature and match contribution amount/currency before confirmation. Captured payments that arrive after closure are marked for a manual refund in Retool; never add them to `amount_raised`.
18. **An item marked for group gifting cannot be claimed or bought through the individual external/catalog flows.** Only the pool procurement operation may mark an item pool's wishlist item purchased.
19. **Manual cash payouts are tracked in `pool_payouts`.** Ops record each completed transfer (bank, account, reference) from the admin Pools screen or Retool; do not add automated bank transfer in v1.

## Reminders

20. **A user must explicitly opt in before being enrolled in Flow 2 reminders (friend reminded about someone else's occasion).** Never auto-enroll an invitee just because they were invited to a wishlist.
21. **Reminder timing is fixed at 14 days and 3 days before the occasion date.** Don't introduce additional reminder intervals without this being a deliberate product decision (see `PRD.md` for context).

## Admin dashboard

29. **Every admin route and page authorizes by role, server-side.** `proxy.ts` keeps users without a role out of `/admin`, but each page calls `requireAdminScreen()` and each `/api/admin/*` handler calls `requireAdminApi()` against the matrix in `lib/admin/roles.ts`. A role is granted only from the Supabase dashboard or the service role; a database trigger rejects any change to `users.role` from a customer session.
30. **Every admin page view and mutation writes an `admin_actions` row** (privacy rule 4), via `logAdminAction()`.
31. **The `events` table is append-only.** No updates or deletes, enforced by RLS and a trigger; the only permitted update is the foreign key detaching rows from a deleted account. Browsers may report only the events in `CLIENT_EVENTS` through `POST /api/events`; everything else is recorded server-side.
32. **Privacy rules are enforced in code.** A segment export describing fewer than 50 people contains no rows; remembrance and sympathy dates never enter a segment; claims on a person's own items are shown only as counts, never attributed to givers; ranked tables show receivers as initials.
33. **Admin status changes never set `pending_payment`, `payment_failed`, or `confirmed`.** Those belong to the Flutterwave webhook.

## Business dashboard

34. **Business dashboard data is always scoped to one `business_account_id`, authorized server-side.** Every server action and `/api/business-dashboard/*` handler re-resolves the session, confirms a `business_users` row for that account, and checks the role against `lib/business-dashboard/permissions.ts` before using the service role. Members may only SELECT their own account's rows through RLS; nothing writes through PostgREST.
35. **Business campaigns are not orders.** A campaign never charges a card or creates an `orders` row; ops fulfil it manually and may link the resulting order via `business_campaigns.linked_order_id`. Campaign totals are estimates (`heads × (per_head + delivery_fee)`), with the delivery fee snapshotted from the account when the campaign is created.
36. **Only Finance-level roles approve.** `approver` and `admin` move a campaign from Pending approval to Approved. A campaign sent for approval whose total is under the account's `auto_approve_under` (admin-set) is approved immediately. Editing an Approved campaign sends it back to Pending approval. Delivered campaigns can't be edited.
37. **Removing a person is a soft delete** (`business_people.active = false`), and duplicates are matched by name, case-insensitively, within the same kind.
38. **A business account is a separate login from a personal one.** A business account is created with its own (work) email; an existing personal account is never converted or linked, even though `gifvtme_create_business_account` could flag an existing user. The business auth screen tells a signed-in personal account to sign out and use a work email, and only ever signs a session out of the current device. Dashboard access needs both a `business_users` membership and `users.account_type = 'business'`; a login with only one is reported as an incomplete business account, never as a personal one.

## Catalog bulk import (Studio tool at `/studio/bulk-import`)

39. **A bulk import never changes an existing product.** Products are created under `product-<handle>`. An existing document at that ID (published, draft or in a release), or another product using the same slug or any SKU (base or variant, compared case-insensitively), blocks the product. This is checked in the preview, again when the import starts, and once more just before each product is written; Sanity's create action also refuses if the draft or the published document exists. A conflict that appears after a check is a failure, never a reason to overwrite or delete. Sanity can't reserve slugs or SKUs, so a clash created in the moment between the last check and the create isn't caught.
40. **References must resolve to exactly one published document.** Collections are matched by slug, suppliers by name. Missing, ambiguous or draft-only references block the product, and so does an `archived` collection; a `draft` collection is only a warning. The importer never creates suppliers or collections.
41. **Missing images and unavailable variants are warnings, not blocks.** A product with no images may be imported as a draft, and so may a variant product whose variants are all unavailable. Publishing an image-free `active` product must show an explicit warning once publishing exists.
42. **Imports write only to `development`, with the editor's own Studio session.** The writable and publishable datasets are hard-coded, as separate lists, in `sanity/tools/bulk-import/safety.ts`; being logged in to a dataset never authorizes writing to it. The importer never uses `SANITY_WRITE_TOKEN`, checks the client's project and dataset before every upload and every product, and stops on a 401 or 403. Production imports need their own approval.
43. **Uploaded assets are never deleted automatically.** Each image is uploaded once; assets that no created draft uses are reported, not removed, because identical content may already be used elsewhere.
44. **Drafts are the default; publishing is chosen and confirmed.** Publishing creates and publishes each *new* product in one all-or-nothing request (create the draft, then publish it), so an existing draft or published product is never replaced, and the tool never publishes an existing draft: those are published in the Structure tool. It needs the same grants as the Studio's Publish button (creating and removing the draft, creating the published document), checked against each document. A product is on the storefront only while it's published *and* its `status` is `active`; the confirmation counts the products that would go live and needs a tick when any would, and it lists active products with no images and products whose variants are all unavailable.

## Currency & locale

22. **All prices throughout the application are in Nigerian Naira (₦) with no currency conversion logic.** Do not introduce a currency parameter to formatting functions, price fields, or payment calls — Naira is hardcoded by design for v1.

## Authentication & data access

23. **Wishlist visibility tiers (private / friends & family / public) are enforced via Supabase RLS policies, not solely application-level checks.** Any new query path against `wishlists` or `wishlist_items` must work correctly under RLS — do not introduce service-role bypasses for convenience in customer-facing code.
24. **Friends & family access is resolved through the `wishlist_invites` table**, matching on `invitee_user_id` or `invitee_email` against the authenticated user. There is no separate "shared with me" permission record.

## Scope boundaries (see also PROJECT_OVERVIEW.md)

25. **The admin dashboard (`/admin/*`) is the only custom internal UI.** Its scope is `feature-specs/23-ADMIN-DASHBOARD-SPEC.md`; Retool remains available. Do not extend it into catalog editing (Sanity owns that) or automated supplier/bank actions without an explicit decision.
26. **Do not build a wallet or stored balance feature.** Pool funds remain tied to their specific pool until procurement or manual payout; they never become an available customer balance.
27. **Do not build a social feed.** Out of scope entirely for v1.
28. **Do not build automated supplier API integration.** Order forwarding to suppliers is a manual, human-driven step in v1.
