<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Gifvtme — Agent Instructions

This file is the entry point for any AI coding agent working in this repository. Read it before making changes.

## Read order

1. `context/PROJECT_OVERVIEW.md` — what Gifvtme is, the two-transaction-flow architecture, v1 scope boundaries
2. `context/PRD.md` — why decisions were made, so you don't relitigate settled debates
3. `context/BUSINESS_RULES.md` — hard invariants, check before touching purchase/pricing/order/auth logic
4. `context/ROADMAP.md` — current build status, so you know what's actually done vs not started

Then the relevant deeper file depending on the task: `architecture/` for system/data/API questions, `design/` for UI questions, `engineering/` for code-level conventions.

## Non-negotiable scope boundaries

Do not build, without an explicit instruction to do so in this specific session:
- Group gifting payment flows (no collecting/holding/refunding money for pooled gifts)
- A custom admin dashboard (Retool is the intentional v1 operational interface)
- An in-app wallet or stored customer balance
- A social feed
- Automated supplier API integration (order forwarding is manual in v1)
- Multi-currency support (Naira only)
- Native mobile apps (web-first)

If a task description seems to imply one of these, stop and flag the conflict rather than proceeding. See `context/PROJECT_OVERVIEW.md` and `context/BUSINESS_RULES.md` rules 21–24.

## The one thing to never get wrong

`wishlist_items.origin` (`external` | `catalog`) determines which of two completely separate transaction flows an item follows. Before writing any code touching purchases, checkout, or pricing, confirm which flow you're in. See `context/architecture/ARCHITECTURE.md` for the full flow breakdown and `context/BUSINESS_RULES.md` rules 4–6.

## Working conventions

- Check `context/architecture/FOLDER_STRUCTURE.md` before creating a new file — there's likely an established place for it.
- Check `context/design/COMPONENT_LIBRARY.md` before building a new component — extend an existing one if it's close, and never build separate mobile/desktop component files (one responsive component per concept).
- Check `context/architecture/API_ROUTES.md` before building a new API route, and update that file when you add or change one.
- Follow `context/engineering/CODING_STANDARDS.md` for TypeScript, import paths, server/client component splits, and naming.
- All prices are Naira, formatted via `formatPrice()` in `lib/utils.ts` — never hardcode a currency symbol or accept a currency parameter.
- All GROQ queries live in `lib/sanity/queries.ts` — never write GROQ inline.

## When you're unsure

Prefer asking a clarifying question over making an assumption when the ambiguity touches: money (pricing, payments, refunds), data visibility (who can see what), or anything listed in `context/BUSINESS_RULES.md`. For lower-stakes ambiguity (e.g. exact spacing, minor copy wording), it's fine to make a reasonable choice and note the assumption rather than blocking on it — match the existing patterns in the codebase as the tiebreaker.

## Keeping context current

If you complete a feature, update `context/ROADMAP.md`'s status section in the same change. If you make a new architectural or product decision during a task, add it to `context/PRD.md` or `context/BUSINESS_RULES.md` as appropriate rather than letting it live only in chat history or a commit message. If you add an API route, component, or env variable, update the corresponding doc (`API_ROUTES.md`, `COMPONENT_LIBRARY.md`, `ENV_VARIABLES.md`) in the same change — these files are meant to stay accurate, not become stale documentation.
