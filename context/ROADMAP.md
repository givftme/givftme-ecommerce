# Gifvtme — Build Status

This checkout did not include a prior roadmap. This file records implemented
features without inferring status for unrelated modules.

## Implemented

- **Account Management** (`feature-specs/19_ACCOUNT_MANAGEMENT_SPEC.md`): profile
  editing, avatar management, account actions, saved addresses, checkout address
  selection, and paginated order history with status tabs.
- **Address Book** (`feature-specs/20_ADDRESS_BOOK.md`): address CRUD and
  default management, checkout address selection and save-for-next-time, with
  deletion leaving the user without an implicit replacement default.
- **Gift Pooling** (`feature-specs/21-GIFT-POOLING.md`): item and general pools,
  authenticated Flutterwave contributions with idempotent reservations, live
  progress, public pool pages, receiver/creator management, receipt and status
  emails, and manual payout tracking.
- **Application design system**: app-wide light, dark, and system appearance,
  Inter interface typography with Belleza display headings, semantic color and
  surface tokens, accessible navigation controls, and responsive styling across
  the existing routes and shared components.

## Operational follow-up

- Apply `gifvtme_migration_033_account_addresses.sql` and
  `gifvtme_migration_034_address_book_state_label.sql` to add the RLS-protected
  address table, default address handling, supporting indexes, and the canonical
  FCT state label. Apply `gifvtme_migration_035_checkout_address_save_idempotency.sql`
  to deduplicate saved checkout addresses by order when payment is retried.
- Apply `gifvtme_migration_036_group_gift_pools.sql` to activate the customer
  pool tables and RPCs. Migration 032's `gift_pools` ledger remains independent.
- Use Retool on `group_gift_pools`, `pool_contributions`, and `pool_payouts` to
  review captured late payments marked with a refund note, process manual
  transfers, and record their completion. Item procurement must call
  `gifvtme_procure_group_gift_pool(pool_id)` so the pool and wishlist item update
  in one database transaction.
