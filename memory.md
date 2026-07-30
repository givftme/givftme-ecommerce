# Memory — Restore Check + Amazon Pre-Block Documentation

Last updated: 2026-07-30

## What was built

- Documented the Amazon pre-block deviation in `context/architecture/THIRD_PARTY_INTEGRATIONS.md`, right under the existing "Amazon is a known difficult case" note: `/api/scrape` (`app/api/scrape/route.ts`) checks the hostname for `amazon.` and returns a 422 immediately, without ever calling Microlink — the spec (`05-ITEM-SCRAPING.md`) describes a "try Microlink, then fall back" sequence for all domains, but Amazon is skipped ahead since it reliably blocks scrapers. Framed explicitly as an intentional perf/UX shortcut, not a bug, with a note not to "fix" it toward the spec's literal wording without checking with the developer first.

## Decisions made

- No new decisions this session — this was closing out an open question from the prior session's memory (see [[feedback-spec-vs-architecture-precedence]]), not making a fresh architectural call.

## Problems solved

- On `/remember restore`, discovered the restored `memory.md` was stale: it described uncommitted changes to `components/wishlist/AddItemSheet.tsx` on branch `item-scraping`, but the repo was actually already back on `main` with a clean tree — that work had been committed (`ddde23c`, `d189a96`) and merged via PR #15 (`fe05b92`) after the memory was last saved. Confirmed via `git log` before treating the memory as current. Lesson: always verify branch/working-tree state against `git status`/`git log` before acting on restored memory, don't assume it's live state.

## Current state

- On branch `main`. One uncommitted change: `context/architecture/THIRD_PARTY_INTEGRATIONS.md` (the Amazon pre-block documentation). Not yet committed — developer hadn't confirmed whether to commit it before this save.

## Next session starts with

Run `/remember restore`, then ask the developer whether to commit the uncommitted `context/architecture/THIRD_PARTY_INTEGRATIONS.md` change, and whether to pick up the still-open test-harness question below.

## Open questions

- Should a test harness be introduced, given the repo has zero test files anywhere? Real spec requirement in `05-ITEM-SCRAPING.md` (unit tests for `parsePrice`, `buildAffiliateUrl`, zod schemas; integration tests for `/api/scrape`), explicitly deferred both this session and the prior one, not rejected.
