# Gifvtme

Gifvtme is a Next.js 16 app for occasion wishlists, external affiliate gifts, and Gifvtme catalog checkout. Supabase owns user and transactional data; Sanity owns catalog and editorial content.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file from the template:

```bash
cp .env.local.example .env.local
```

Fill in the required local variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `NEXT_APP_URL`

Optional local integrations include Microlink, Resend, cron, and affiliate IDs. You can find configuration names in [.env.local.example](.env.local.example) and inspect each integration's environment checks for its requirements.

Gift Fetch and the admin candidate queue also use `ADMIN_EMAILS`,
`EXCHANGERATE_API_KEY`, `SANITY_WRITE_TOKEN`, `FETCH_MARKUP_PERCENT`,
`FETCH_DELIVERY_BUFFER_NGN`, and `FETCH_ROUNDING_NGN`. `SANITY_WRITE_TOKEN`
is server-only and is required only when publishing a fetched candidate as a
catalog draft.

Sanity is configured through `sanity/env.ts`, `sanity.config.ts`, and `sanity/lib/client.ts`. Set `NEXT_PUBLIC_SANITY_DATASET` explicitly, usually `production` for a launch-like dataset. The embedded Studio is available at `/studio` when the app is running.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configurable gift pricing

`/admin/pricing` uses `ADMIN_EMAILS` authorization. Apply
`gifvtme_migration_030_configurable_gift_pricing.sql` to development and verify
its privileges before rollout. Supply a server only `PRICING_PREVIEW_SECRET`
containing at least 32 random bytes. Preview and publish each policy explicitly;
no launch rates are seeded, and publishing zero is valid.

Set `GIFT_PRICING_V1_ENABLED=true` to show linked gift estimates on shared wishlist
cards and item pages and expose their authorized pricing reads. Missing rates or source data
show pricing unavailable. Apply `gifvtme_migration_031_item_price_sources.sql`
before deploying the item source fix. New candidate links retain each item's
currency and conversion evidence. Existing links without that evidence remain
unpriced until it is recaptured; never backfill them from the shared candidate.
An edited foreign amount requires a matching recorded conversion before an
estimate can be shown. Delivery remains unconfirmed. This first slice does
not enable sourced checkout, quote confirmation, collection, or payouts.

Versioned estimates use original NGN source costs (or a recorded conversion),
whole Naira half up rounding, and the active database rate. Legacy Museum list
and candidate editing paths still use the `FETCH_*` settings until their later
migration; those fields never supply the new estimate. Disable the rollout
switch to stop versioned estimate reads. Retain pricing history and never
recalculate existing orders during rollback.

## Project Context

- [Project instructions and scope](AGENTS.md)
- [Application routes](app/AGENTS.md)
- [API handlers](app/api/AGENTS.md)
- [Shared components](components/AGENTS.md)
- [Domain logic and integrations](lib/AGENTS.md)
- [Sanity content](sanity/AGENTS.md)
- [UI registry](ui-registry.md)

## Account experience

`/account` is the authenticated navigation hub. Profile editing lives at `/account/profile`, order history at `/account/orders`, and existing order detail links remain at `/account/orders/[id]`. `/account/notifications` explains the currently unavailable global preferences, while `/account/security` displays connected email and Google identities. Phone sign in and identity linking are not enabled by these pages. Sign out is an action in the Account navigation.
