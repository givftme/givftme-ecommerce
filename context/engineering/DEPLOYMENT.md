# Gifvtme — Deployment & DevOps

## Hosting

Vercel, deploying directly from the Next.js project root. No custom server — App Router + Vercel's standard Next.js build pipeline.

## Supabase production setup

1. Create a production Supabase project, separate from any local/dev project.
2. Run the complete Supabase migration chain in the SQL Editor, in this exact order: `gifvtme_migration.sql`, `gifvtme_migration_002.sql`, `gifvtme_migration_003.sql`, `gifvtme_migration_004_wishlist_rls.sql`, `gifvtme_migration_005_occasion_wishlist.sql`. Each migration depends on the schema state produced by the previous one.
3. Confirm RLS is enabled on every table (the migrations enable it explicitly per table, but verify in the dashboard before launch — a table with RLS accidentally disabled is a serious data exposure risk).
4. Enable email and Google OAuth providers under Authentication → Providers.
5. Set the Site URL and Redirect URLs under Authentication → URL Configuration to match the production domain (this must match `NEXT_PUBLIC_APP_URL`).

## Sanity production setup

1. Create the Sanity dataset used by `sanity/lib/client.ts`; for launch, set `NEXT_PUBLIC_SANITY_DATASET` explicitly to `production` in every production environment.
2. Deploy Sanity Studio (either hosted via Sanity's own hosting or embedded — decide before launch, not yet specified as of this writing in `ROADMAP.md`).
3. Confirm the catalog team has Studio access with appropriate roles before launch — this is how products actually get added, there is no other path in v1.

## Vercel environment variables

All variables from `ENV_VARIABLES.md` must be set in Vercel's project settings (Production environment), not just locally. Double-check the `NEXT_PUBLIC_*` ones are present at build time, not just runtime — Next.js inlines these during build.

## Pre-launch checklist

- [ ] All Supabase migrations through `gifvtme_migration_005_occasion_wishlist.sql` run against production in order
- [ ] RLS verified enabled on every table
- [ ] Sanity production dataset populated with at least the initial occasions/collections/products needed for launch
- [ ] `NEXT_PUBLIC_APP_URL` set to the real production domain
- [ ] Flutterwave webhook URL (once built) pointed at the production domain, not localhost
- [ ] Retool connected to the production Supabase project (not a dev project) with the correct service role key
- [ ] Resend sender domain verified (not just using a default/test sending address)
- [ ] At least one full manual test of both transaction flows end to end (affiliate redirect + mark purchased, and catalog checkout + Flutterwave payment) against production infrastructure before announcing launch

## Domain & redirects

The production domain must be consistent across: `NEXT_PUBLIC_APP_URL`, Supabase Auth's Site URL/Redirect URLs, and any Flutterwave callback/webhook URL. A mismatch here is one of the most common silent-failure sources in a launch — auth redirects or payment callbacks pointing at the wrong domain.

## Rollback

No formal rollback tooling is defined for v1 given the solo timeline. If a deploy introduces a serious bug, the practical rollback is redeploying the previous Vercel deployment (Vercel keeps deployment history and allows promoting a previous one) — this does not roll back database migrations, so be cautious about deploying schema changes and code changes that depend on them in the same release without a tested path.
