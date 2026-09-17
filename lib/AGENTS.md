# Domain logic and integrations

## Overview

This directory contains reusable domain logic, validation, result types, and service adapters. You can keep route handlers focused on request handling by delegating shared behavior here.

## Key files

| File | Owns |
|---|---|
| `api/response.ts` | JSON parsing and error responses |
| `utils.ts` | Class merging and price formatting |
| `supabase/client.ts` | Browser session client |
| `supabase/server.ts` | Server session and privileged clients |
| `sanity/queries.ts` | Storefront GROQ queries |
| `flutterwave/getActivePrice.ts` | Authoritative checkout price calculation |
| `reminders/constants.ts` | Reminder windows and supported channels |

## Conventions

Domain folders commonly separate `types.ts`, `validation.ts`, `server.ts`, and pure helpers. You can reuse those types and schemas across forms and handlers instead of repeating their shapes. Zod input and output types distinguish form values from normalized values where schemas transform data.

`readJson` yields `unknown` or `null` for malformed JSON. You can validate the result before domain work. `jsonError` returns an error string with an explicit HTTP status.

You can use the browser client in interactive components and the cookie based server client for user requests. `createServiceClient` uses privileged credentials and bypasses row policies, so its use requires explicit authorization checks appropriate to the operation.

Pure helpers and validation tests live beside source files as `*.test.ts`. API tests live beside handlers as `route.test.ts`. You can run a focused suite from the repository root with `npm test -- lib/checkout/validation.test.ts`.

## Gotchas

The Sanity client is in `../sanity/lib/client.ts`. This directory holds query projections, result types, and adapters instead.

Reminder scheduling currently supports email only, with windows of 14 and 3 days. A `push` database value does not establish a delivery implementation.

The checkout helper implements a five minute sale grace period. Root AGENTS.md records the unresolved conflict with the removed business rules. You can confirm the intended rule before changing pricing.

## Related context

See [project context](../AGENTS.md), [API context](../app/api/AGENTS.md), and [Sanity context](../sanity/AGENTS.md).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
