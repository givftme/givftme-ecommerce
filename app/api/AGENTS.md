# API handlers

## Overview

This directory contains customer API handlers, payment callbacks, and scheduled jobs. You can find the request and response contracts in `context/architecture/API_ROUTES.md` from the repository root.

## Key files

| File | Owns |
|---|---|
| `../../lib/api/response.ts` | `readJson` and `jsonError` helpers |
| `../../lib/wishlist/server.ts` | Shared API authentication and wishlist ownership helpers |
| `important-dates/route.ts` | Example of authentication, validation, and domain delegation |
| `checkout/route.test.ts` | Direct handler tests with mocked service boundaries |
| `../../vercel.json` | Configured cron paths and schedules |

## Conventions

Existing customer handlers create a server client and check the authenticated user within the handler. You can reuse the shared authentication helper and relevant domain ownership checks; the proxy does not supply API authorization.

`readJson` returns `unknown` or `null` for malformed JSON. You can validate it with the relevant `lib/<domain>/validation.ts` schema before invoking domain logic. `jsonError` produces `{ error: string }` with an explicit HTTP status.

Wishlist owner checks intentionally return 404 for both missing and nonowned IDs. This avoids revealing another person's wishlist. You can preserve that behavior when extending those endpoints.

Existing dynamic handlers await `context.params`. Route tests sit beside handlers as `route.test.ts` and call exported methods with Request objects. You can mock external services as the checkout tests do without contacting live systems.

## Gotchas

Scheduled jobs and payment webhooks use their own authentication contracts. Their access checks are distinct from a customer session. A scheduled endpoint existing in this directory does not mean it is configured in `vercel.json`.

Checkout and external purchase marking remain separate flows. You can consult root AGENTS.md and the relevant feature specification before changing either contract.

## Related specs

See [API routes](../../context/architecture/API_ROUTES.md) and [error handling](../../context/architecture/ERROR_HANDLING.md). The audit flagged stale reminder delivery and pricing descriptions in the latter for human review.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
