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

Optional local integrations include Microlink, Resend, cron, and affiliate IDs. See [ENV_VARIABLES.md](context/engineering/ENV_VARIABLES.md) for the full contract.

Sanity is configured through `sanity/env.ts`, `sanity.config.ts`, and `sanity/lib/client.ts`. Set `NEXT_PUBLIC_SANITY_DATASET` explicitly, usually `production` for a launch-like dataset. The embedded Studio is available at `/studio` when the app is running.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Context

- [Project overview](context/PROJECT_OVERVIEW.md)
- [Architecture](context/architecture/ARCHITECTURE.md)
- [Database schema](context/architecture/DATABASE_SCHEMA.md)
- [API routes](context/architecture/API_ROUTES.md)
- [Coding standards](context/engineering/CODING_STANDARDS.md)
