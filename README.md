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
- `NEXT_PUBLIC_APP_URL`

Optional local integrations include Microlink, Resend, cron, and affiliate IDs. You can find configuration names in [.env.local.example](.env.local.example) and inspect each integration's environment checks for its requirements.

Sanity is configured through `sanity/env.ts`, `sanity.config.ts`, and `sanity/lib/client.ts`. Set `NEXT_PUBLIC_SANITY_DATASET` explicitly, usually `production` for a launch-like dataset. The embedded Studio is available at `/studio` when the app is running.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
