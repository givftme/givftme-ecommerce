# API handlers

## Overview

This directory contains customer API handlers, payment callbacks, and scheduled jobs. You can inspect exported handlers, domain validation schemas, and colocated tests for current request and response contracts.

## Key files

| File | Owns |
|---|---|
| `../../lib/api/response.ts` | `readJson` and `jsonError` helpers |
| `../../lib/wishlist/server.ts` | Shared API authentication and wishlist ownership helpers |
| `addresses/route.ts`, `addresses/[id]/route.ts` | Owner-scoped address book CRUD and default changes |
| `account/addresses/route.ts`, `account/addresses/[id]/route.ts`, `account/addresses/[id]/set-default/route.ts` | Account-scoped address book API contract and explicit default promotion |
| `orders/route.ts` | Authenticated order history tabs and pagination |
| `flutterwave/webhook/route.ts` | Signature-verified payment callback for catalog orders and pool contributions |
| `pools/route.ts`, `pools/[id]/route.ts` | Pool creation, public pool data by token, and receiver title edits |
| `pools/[id]/contribute/route.ts`, `pools/[id]/cash-out/route.ts`, `pools/[id]/cancel/route.ts` | Authenticated pool payment and management actions |
| `pools/notifications/route.ts` | CRON_SECRET-protected retries for queued pool cash-out emails |
| `dashboard/pools/route.ts` | Current user's active and past pools |
| `og/wishlist/[token]/route.tsx`, `og/pool/[token]/route.tsx` | Public, edge-rendered 1200×630 link-preview PNGs for shared wishlists and gift pools |
| `important-dates/route.ts` | Example of authentication, validation, and domain delegation |
| `checkout/route.test.ts` | Direct handler tests with mocked service boundaries |
| `../../vercel.json` | Configured cron paths and schedules |

## Conventions

Existing customer handlers create a server client and check the authenticated user within the handler. You can reuse the shared authentication helper and relevant domain ownership checks; the proxy does not supply API authorization.

`readJson` returns `unknown` or `null` for malformed JSON. You can validate it with the relevant `lib/<domain>/validation.ts` schema before invoking domain logic. `jsonError` produces `{ error: string }` with an explicit HTTP status.

Wishlist owner checks intentionally return 404 for both missing and nonowned IDs. This avoids revealing another person's wishlist. You can preserve that behavior when extending those endpoints.

Existing dynamic handlers await `context.params`. Route tests sit beside handlers as `route.test.ts` and call exported methods with Request objects. You can mock external services as the checkout tests do without contacting live systems.

Admin handlers under `admin/` authorize with `getAdminApiUser()` from `lib/admin/auth.ts`, which returns null unless the session email is listed in `ADMIN_EMAILS`.

## Gotchas

Scheduled jobs and payment webhooks use their own authentication contracts. Their access checks are distinct from a customer session. A scheduled endpoint existing in this directory does not mean it is configured in `vercel.json`.

Checkout and external purchase marking remain separate flows. You can consult root AGENTS.md and inspect the relevant handler and tests before changing either contract.

Gift pooling is a third flow. Its Flutterwave webhook branch verifies the payment
before calling the pool confirmation RPC; keep pool payment records out of
orders and purchases. Late captured payments are marked for manual ops review.

The OG image routes are unauthenticated because crawlers call them. The wishlist
route resolves the share key through the anon `gifvtme_get_shared_wishlist` RPC
via `createPublicClient()`, never the service client, so private lists fall back
to `/og-default.jpg`. A malformed token gets 400 and every other failure gets 200,
both with the brand image. Helpers live in `lib/og/`, and the Inter TTFs they
load are served from `public/fonts/`.

Account APIs authenticate inside each handler. Address rows are protected by
their own RLS policy; keep user ownership in every query. `/api/orders` accepts
`tab=active|completed|cancelled` and a one-based `page` value.

The address book's account UI uses `/api/account/addresses`; the original
`/api/addresses` endpoints remain as compatibility routes. Deleting a default
address leaves the user with no default until they explicitly choose one.

## Related context

See [project context](../../AGENTS.md), [domain context](../../lib/AGENTS.md), and [response helpers](../../lib/api/response.ts).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
