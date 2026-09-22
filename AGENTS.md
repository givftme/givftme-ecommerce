<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Gifvtme — Agent Instructions

This file is the entry point for any AI coding agent working in this repository. Read it before making changes.

## Read order

Start with this file for repository-wide instructions and scope boundaries.

The current product specification lives in `docs/product/`. For product
planning, feature scope, architecture, or behavior decisions, read
`docs/product/README.md` and the relevant product documents it references
before treating existing implementation as intended product behavior.

The repository is an existing brownfield application. Inspect the current
implementation, tests, and the relevant nested `AGENTS.md` before making
changes. Reuse existing functionality where it remains compatible with the
current product specification.

Existing behavior is not automatically a product requirement. Where the
implementation conflicts with `docs/product/`, identify the difference as
migration or completion work rather than preserving the existing behavior
by default.

Historical references in comments, `memory.md`, or deleted `context/`
documents are not current product specifications.

## The one thing to never get wrong

`wishlist_items.origin` (`external` | `catalog`) determines which of two completely separate transaction flows an item follows. Before writing any code touching purchases, checkout, or pricing, confirm which flow you're in. External gifts use affiliate redirects and purchase marking in `app/api/purchases/route.ts`. Catalog gifts use checkout and Flutterwave payment verification in `app/api/checkout/route.ts` and `app/api/flutterwave/webhook/route.ts`. External items never belong in catalog checkout.

## Working conventions

- You can check nearby files and the nested AGENTS.md before choosing a location for new code.
- You can check `components/AGENTS.md`, existing primitives, and `ui-registry.md` before building a component. Extend an existing component when suitable; keep one responsive component per concept.
- You can check `app/api/AGENTS.md`, existing handlers, and their tests before adding or changing an API route.
- TypeScript uses strict mode and the `@/` root alias. Pages default to server components; interactive components declare `"use client"`. Domain types and Zod validation live under `lib/`.
- All prices are Naira, formatted via `formatPrice()` in `lib/utils.ts` — never hardcode a currency symbol or accept a currency parameter.
- All GROQ queries live in `lib/sanity/queries.ts` — never write GROQ inline.

## When you're unsure

Prefer asking a clarifying question over making an assumption when ambiguity touches money (pricing, payments, refunds), data visibility, or the scope boundaries above. For minor spacing or copy choices, you can match existing patterns and note the assumption.

The earlier audit found a pricing conflict: the removed business rules prohibited a grace period, but `lib/flutterwave/getActivePrice.ts` implements five minutes after sale expiry. Removing the documents did not resolve that product decision. You can confirm the intended rule before changing this behavior.

## Keeping context current

<<<<<<< Updated upstream
The current product source of truth lives in `docs/product/`. Product
requirements should remain there rather than being duplicated throughout
nested AGENTS.md files.

Record confirmed global repository conventions and durable engineering
decisions here. Record area-specific engineering conventions in the relevant
nested AGENTS.md.

Keep `README.md`, `.env.local.example`, and `ui-registry.md` aligned when a
change affects their guidance.

Planning artifacts belong under `docs/scope/`, and feature specifications
produced by architecture work belong under `docs/specs/`.

## Commands

You can use npm from the repository root: `npm ci` to install locked dependencies, `npm run dev` for development, `npm run build` for production compilation, `npm start` to serve the build, `npm run lint` for ESLint, and `npm test` for Vitest. You can run `npx tsc --noEmit` for a separate type check.

Vitest discovers colocated `*.test.ts` files and excludes `.agents/`. The `@/` alias resolves from the repository root in TypeScript and Vitest.

## Context files

- [app/AGENTS.md](app/AGENTS.md) (Route placement, layouts, and providers.)
- [app/api/AGENTS.md](app/api/AGENTS.md) (API authentication, validation, and handler tests.)
- [components/AGENTS.md](components/AGENTS.md) (Shared UI and cart context.)
- [lib/AGENTS.md](lib/AGENTS.md) (Domain helpers, service boundaries, and tests.)
- [sanity/AGENTS.md](sanity/AGENTS.md) (Studio schemas and storefront integration.)
=======
If you complete a feature, update `context/ROADMAP.md`'s status section in the same change. If you make a new architectural or product decision during a task, add it to `context/PRD.md` or `context/BUSINESS_RULES.md` as appropriate rather than letting it live only in chat history or a commit message. If you add an API route, component, or env variable, update the corresponding doc (`API_ROUTES.md`, `COMPONENT_LIBRARY.md`, `ENV_VARIABLES.md`) in the same change — these files are meant to stay accurate, not become stale documentation.

## Stack

This is one npm application using TypeScript with strict checking, Next.js 16 App Router, React 19, and Tailwind CSS v4. Supabase owns transactional data, Sanity owns catalog content, and Vitest runs the automated tests. See `package.json` for dependency versions.

## Commands

You can use `npm ci` to install locked dependencies, `npm run dev` for development, `npm run build` for a production build, `npm run lint` for ESLint, and `npm test` for Vitest. For a focused test, use `npm test -- path/to/file.test.ts`. Tests live alongside source; `vitest.config.ts` excludes `.agents/` from the application suite.

## Specs

Existing feature specifications live in `context/feature-specs/`. You can use these with `context/ROADMAP.md` to locate the relevant behavior and implementation status.

## Context files

- [app/AGENTS.md](app/AGENTS.md) (Route groups, layouts, and provider placement.)
- [app/api/AGENTS.md](app/api/AGENTS.md) (API validation, response helpers, and route tests.)
>>>>>>> Stashed changes
