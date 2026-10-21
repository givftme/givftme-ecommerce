# Givftme — Build Status

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
- **Metadata & Open Graph images** (`feature-specs/22-METADATA-AND-OG-IMAGES.md`):
  a "%s — Givftme" title template with canonical URLs, Open Graph and Twitter tags
  on public pages, noindex on auth, dashboard, account, cart, checkout and
  transactional gift pages, Sanity-driven product, occasion and collection
  metadata, and edge-rendered preview images at `/api/og/wishlist/[token]` and
  `/api/og/pool/[token]` that fall back to `/og-default.jpg`.
- **Application design system**: app-wide light, dark, and system appearance,
  Inter interface typography with Belleza display headings, semantic color and
  surface tokens, accessible navigation controls, and responsive styling across
  the existing routes and shared components.

- **Business page** (`/business`): corporate gifting landing page with a 3D brand
  studio (cake pack, gift box, gift card), occasion details, plans, a gift card
  and yearly budget estimator, a corporate calendar, and an Experience Centre
  brief form. Lead capture only: no checkout, pricing or database writes.

- **Admin dashboard** (`feature-specs/23-ADMIN-DASHBOARD-SPEC.md`): role-gated
  `/admin` with all 15 screens (Pulse, Growth & Cohorts, Calendar Engine,
  Wishlists & Sharing, Pools and payouts queue, Demand, Orders with status
  updates, Corporate, Diaspora, Segments & Exports, Money, People, Reviews,
  Enquiries, Reminder Failures), the append-only `events` log wired into the
  catalogue's call sites, the `admin_actions` audit trail, and the `/business`
  brief form now saving to `business_enquiries`.

- **Business dashboard** (`feature-specs/24-BUSINESS-DASHBOARD-SPEC.md`):
  `/business-dashboard` for company HR teams. Sign in / create a business
  account (`users.account_type = 'business'`), and a single-page shell with
  Overview, Upcoming moments, Staff, Clients & partners, Bulk upload (CSV or
  pasted Excel rows, column mapping, review), Campaigns with a 3-step wizard and
  Draft → Pending approval → Approved flow, Year calendar, Automatic rules,
  Deliveries, Budget & invoices, Brand kit with live preview, and Team &
  approvals. Role permissions (admin / editor / approver / limited), year
  schedule CSV export, "Send a brief" into `business_enquiries`, and business
  events in the `events` log.

- **Account type selection** (`feature-specs/25-ACCOUNT-TYPE-SELECTION-SPEC.md`):
  `/get-started` picks Individual (`/signup?type=individual`) or Business
  (`/business-dashboard/auth?type=business`, opens on Create account), carries
  any `redirect` through, and pre-highlights the business card for
  `?hint=business`. `/signup` without `type=individual` redirects there, the
  proxy sends signed-in visitors home, and every sign-up CTA links to it.
  Client events `get_started.viewed`, `.individual_selected`, `.business_selected`.

- **Business entry points**: `/business` now leads into the account system. The
  hero sub-line and the HR dashboard section show, by viewer, "Sign in" and
  "Create a business account" (`/get-started?hint=business`), or "Open your
  dashboard" for business members (`BusinessAccountCta`). On `/business` the
  Navbar's sign-in and get-started go to the business screens, and business
  accounts get a Dashboard link on every public page. The proxy sends a
  signed-in customer choosing business to the create-account tab. The business
  auth screen tells a signed-in personal account to use a separate work email,
  links to the personal login, and signs sessions out of this device only. A
  login whose account type and membership disagree gets an "incomplete account"
  notice. It offers to resend the confirmation link (after sign-up, after an
  `email_not_confirmed` sign-in, and with an email field after an expired link),
  again once a 60-second cooldown passes. Failed business confirmation links
  return there; failed or cancelled Google sign-ins say so instead. Overview has
  a derived "Get set up" checklist, and the sidebar links back to `/business`.
  `PageWrapper` keeps name and avatar if `account_type` can't be read.

## Operational follow-up

- Apply `gifvtme_migration_042_business_dashboard.sql` (business tables, RLS,
  `users.account_type`, and the `gifvtme_create_business_account` RPC) before
  anyone signs up at `/business-dashboard/auth`.
- Business dashboard gaps left for a decision: there is no invoices or payment
  table, so invoices are derived per delivery month from approved and delivered
  campaigns and marked "Due" or "Upcoming", never "Paid"; "Invite colleague"
  only shows a toast (v1 per the spec), so colleagues have no way to join an
  account yet; proof-of-delivery rows and
  `business_campaigns.linked_order_id` are written by ops in Retool; the
  automatic rules and reminder settings are stored but nothing sends reminders
  or creates campaigns from them yet.

- Apply `gifvtme_migration_041_admin_dashboard.sql` and grant the first team role
  in the Supabase SQL editor. People listed in `ADMIN_EMAILS` also need a role to
  reach `/admin/gift-candidates` and `/admin/pricing`, because the proxy now gates
  all of `/admin`.
- Check the nine provisional lifecycle segments (`lib/admin/segments.ts`) against
  `Givftme-07-Admin-and-Data-Layer.docx`, which isn't in this repository.
- Not built from the spec: the Diaspora map (tables and bars only), the Segments
  "Message" button (shown disabled as the spec marks it future), and gift card,
  business plan, and Plus data, which have no data model yet.

- Fill in `CONTACT` in `app/business/_components/content.ts` (WhatsApp, email,
  phone and an `enquiryEndpoint`) and the bracketed plan prices and FAQ answers.
  Until `enquiryEndpoint` is set, the business brief form shows its thank-you
  without sending the brief anywhere.

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
