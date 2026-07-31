# Memory — Reminders (11) Flow 1 Build + Real Delivery + Review-Fix Rounds

Last updated: 2026-07-31

## What was built

- On branch `reminders` (created after `affiliate-purchase` merged via PR #20), developer said "Read and implement exactly as specified" for `context/feature-specs/11-REMINDERS.md`. Per [[feedback-spec-vs-architecture-precedence]], flagged the conflict before writing anything — 7th confirmation of this recurring pattern. Ran an Explore-subagent audit: Flow 2 (invitee opt-in) and the owner-reminder scheduling/cron scaffolding were already shipped under migration 006; **Flow 1 (important dates) was completely unbuilt** — `important_dates` existed live with zero application code touching it, and `/dashboard/dates` was a static empty-state stub; `/api/reminders` was an intentional no-op stub that queued due reminders but never sent anything. Developer approved building all three: full Flow 1, real delivery, and the two Flow 2 gaps (unsubscribe endpoint, reschedule-on-occasion-date-change).
- **First pass — built from scratch:** migration `gifvtme_migration_015_reminders.sql` (reminders delivery columns + `important_dates` table/RLS); `lib/important-dates/{types,validation,server}.ts`; `lib/reminders/scheduleImportantDateReminders.ts`; `/api/important-dates` + `/api/important-dates/[id]`; a real `/dashboard/dates` UI (`ImportantDatesClient`/`ImportantDateCard`/`ImportantDateForm` in `components/reminders/`); `lib/reminders/buildReminderEmail.ts` + `sendReminderEmail` in `lib/email/resend.ts`; rewrote `/api/reminders`'s cron for actual Resend delivery with retry/`permanently_failed`; `/api/reminders/unsubscribe`; `rescheduleInviteeRemindersForOccasion` wired into the occasion PATCH route. Added `lib/important-dates/validation.test.ts` and `lib/reminders/buildReminderEmail.test.ts` (50/50 tests passing, up from 34).
- **Then ~13 rounds of "verify this finding against current code, fix only if still valid"** (external review tool against the open PR), each independently re-verified before fixing:
  1. `/api/important-dates` routes leaked raw DB error messages to the client — added `ImportantDateInputError` marker class so only genuinely user-facing messages (e.g. unresolvable wishlist link) surface; everything else logs server-side and returns a generic message.
  2. Cron: a successful email send followed by a failed recurring-date advance was unrecoverable (reminder already marked `sent`, so never retried) — added `reminders.advance_pending` + `retryPendingAdvancements()` so the advance step retries independently on later cron runs.
  3. Cron: no protection against two overlapping cron invocations double-sending the same reminder, and no idempotency on Resend retries — added an atomic per-row claim (`claimed_at`, conditional `UPDATE`) and a Resend `Idempotency-Key` (the reminder's own id); also validated every previously-unchecked Supabase update result and made thrown errors increment `retry_count` too.
  4. `/api/reminders/unsubscribe` didn't check the reminders-delete result — could report "unsubscribed" while pending reminders silently remained queued. Now checks and returns a failure page if the delete fails.
  5. `ImportantDateCard` had per-card independent menu state — opening one date's three-dot menu didn't close another already-open one. Lifted to `openMenuId` in `ImportantDatesClient`.
  6. **Build-breaking external edit** to `ImportantDateForm.tsx` (duplicate `const payload` declaration) — fixed by renaming, while keeping the edit's actual good intent (omit `linked_wishlist_url` from a PATCH when the user never touched that field, so an unrelated edit can't silently clear an already-resolved link).
  7. Corrected an inaccurate line in `11-REMINDERS.md` claiming a date within 3 days still gets both 14-/3-day reminder rows (it gets neither — both windows are already in the past by then).
  8. Moved ROADMAP's Reminders entry from "Done" to "In progress" — migration 015 isn't confirmed applied to Supabase, so claiming the feature Done overstated it.
  9. `createImportantDate` gated scheduling on `isFutureDateOnly` (strictly after today) while validation only rejects strictly-past dates — swapped to `!isPastDateOnly` to match (a no-op in practice today, since the 14-/3-day windows are always past for a same-day date, but now consistent).
  10. `deleteImportantDate` only pre-deleted *unsent* reminders before deleting the parent row — a *sent* reminder (the common case for any date that's fired before) could trigger an FK violation if the pre-existing, unverifiable `important_date_id` FK wasn't `CASCADE`. Added an explicit `ON DELETE CASCADE` to migration 015 and simplified the delete to one atomic statement.
  11. Parallelized `rescheduleInviteeRemindersForOccasion` (per-invite `Promise.allSettled`) and the two independent reschedule calls in the occasion PATCH route (`Promise.all`) — pure latency win, no correctness change.
  12. **Second build-breaking external edit**, this time to `buildReminderEmail.ts` (a helper renamed `daysCopy` → `resolveDays` in one branch but not the other two) — fixed, then extracted the `windows`/`channels`/`subDays` trio (previously copy-pasted identically across all three scheduling files) into `lib/reminders/constants.ts`.
  13. Removed `"push"` from `REMINDER_CHANNELS` — no push delivery infrastructure exists anywhere in this codebase, so every scheduled push-channel row was permanently undeliverable and would accumulate forever (worse for a recurring important date, rescheduling every year).
- **Not a typo, corrected understanding:** "Givftme" (not "Gifvtme") appears twice in the Flow-1 reminder email body (`lib/reminders/buildReminderEmail.ts`). Grepped the codebase and found "Gifvtme" used consistently in ~50 other places (README, docs, Navbar/Footer logo, `gifvtme.com` domain ref) — flagged the discrepancy to the developer directly rather than assuming; developer confirmed "Givftme" in the email body is intentional and should stay. Leaving as-is.
- All of the above is committed: two commits on `reminders` — `cdb8379` ("feat(reminders): add important dates management and reminder scheduling") and `d3fdbe1` ("Implement coderabbit suggestions") — pushed, branch up to date with `origin/reminders`. (These commits weren't made by me in this session — I never ran `git commit`; the working tree was already clean with both commits present when checked.)

## Decisions made

- Confirmed a 7th time that shipped/architecture-documented code wins over a literal spec rewrite by default, even against "implement exactly as specified" — [[feedback-spec-vs-architecture-precedence]] continues to hold.
- Flow 1's `occasion_type` reuses the existing 6-value `OCCASION_TYPES` enum rather than the spec's narrower 5-value list, for vocabulary/UI consistency with user-created occasions.
- Spec's `linked_wishlist_url` (raw stored URL) became `linked_wishlist_id` (FK), resolved server-side via the existing `gifvtme_get_shared_wishlist` RPC rather than trusting a pasted string — keeps the reminder email's wishlist link always current.
- `important_dates` deletion is a hard delete (no soft-archive) — simple personal note list, no purchase/order history riding on it.
- FK-level `ON DELETE CASCADE` chosen over an application-level transaction wrapper for delete-time reminder cleanup — one atomic SQL statement is a stronger guarantee than sequencing two app-level calls, and treats sent/unsent reminders identically.
- A Resend `Idempotency-Key` (the reminder's own row id) plus a `claimed_at` lease was chosen over building any real distributed-transaction machinery — cheapest way to make retries and concurrent cron runs safe against duplicate real emails.
- `"push"` stays a supported `channel` value (not removed from the type) but is excluded from `REMINDER_CHANNELS` — keeps a clean, one-line seam to add real push delivery later without another migration.

## Problems solved

- The 13 items above were each independently verified against current code before fixing — not assumed valid just because a review tool flagged them.
- Recurring thread worth flagging forward: **two separate external edits landed mid-session on files I'd already written and broke the build each time** (a duplicate `const payload` in `ImportantDateForm.tsx`; a helper renamed in one call site but not the other two in `buildReminderEmail.ts`). Both had to be fixed before the actual requested review finding could even be validated. Worth the developer checking whether whatever is applying these edits runs `tsc` before/after — it currently doesn't seem to.

## Current state

- Branch `reminders` (off `main`, after `affiliate-purchase` merged via PR #20). Two commits, pushed, `origin/reminders` up to date, working tree clean.
- Migration `gifvtme_migration_015_reminders.sql` has grown substantially across this session: reminders delivery columns (`days_before`, `retry_count`, `permanently_failed`, `sent_at`, `advance_pending`, `claimed_at`), the `important_dates` table + owner-only RLS, and an explicit `important_date_id` FK with `ON DELETE CASCADE`. **Still not confirmed applied to Supabase** — this is why `ROADMAP.md`'s Reminders entry is deliberately kept under "In progress," not "Done."
- `tsc`, `eslint`, and `npm test` (50/50) all clean as of the last check.
- Migration 015 confirmed applied to Supabase by the developer 2026-07-31 — `context/ROADMAP.md`'s Reminders entry moved from "In progress" to "Done" accordingly. "Givftme" in the reminder email body is intentional (developer-confirmed), not a typo — left unchanged. This reconciliation pass is complete; no more review findings incoming for this branch.

## Next session starts with

Run `/remember restore`. The `reminders` branch reconciliation pass is done — migration 015 applied, ROADMAP updated, no open fixes pending. Ask the developer what the next feature-spec or task is.

## Open questions

- What's applying those two build-breaking mid-session edits (not me, not confirmed to be the developer directly) — worth the developer investigating since it doesn't appear to run a type check before leaving code in that state.
