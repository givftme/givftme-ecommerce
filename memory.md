# Memory — Profile Management + Phone Column Security Fix

Last updated: 2026-07-28

## What was built

- Implemented `02-PROFILE-MANAGEMENT.md`: `/account/profile` page (`page.tsx`, `ProfileForm.tsx`, `DeleteAccountDialog.tsx`, `actions.ts`, `avatar.ts`), `lib/account/validation.ts`, migration `gifvtme_migration_008_profile_management.sql`, avatar threaded through `Navbar`/`PageWrapper`/`PublicPageShell`, and a link from `/account`. Committed as `39f140d`.
- Found and fixed a security issue in migration 008: a blanket `GRANT SELECT (phone) ON public.users TO authenticated` combined with the existing `gifvtme_users_select_allowed_profiles` RLS policy (migration 004, `gifvtme_can_read_profile()`) would let a purchase/gift counterparty — not just the row owner — read another user's phone number. Fixed by removing the grant and adding an owner-scoped `gifvtme_get_own_phone()` `SECURITY DEFINER` RPC; `page.tsx` now calls that RPC instead of selecting `phone` directly.
- Two small unrelated fixes landed via `git pull` from `origin/profile-management`, authored by a CodeRabbit bot: `6509c3b` (try/catch around the delete-account call in `DeleteAccountDialog.tsx`) and `031d9fb` (added `.trim()` to `full_name` in `lib/account/validation.ts`).
- Final committed state: the phone-RPC fix (migration SQL + `page.tsx`) is in commit `2b3dadd` ("implement coderabbit suggestions"); the matching `DATABASE_SCHEMA.md`/`ROADMAP.md` doc updates are in `834627e`.

## Decisions made

- Account deletion is blocked while the user has an order in `confirmed`/`under_review`/`forwarded`/`shipped` status. The spec flagged this as an open question with its own recommendation; took the recommendation. Recorded as `BUSINESS_RULES.md` rule 25 and a `PRD.md` decision.
- `avatars` Storage bucket is public (not private/signed-URL like `wishlist-images`), per the spec and because `avatar_url` is already anon-readable at the DB layer for shared-wishlist display — a private bucket adds signed-URL/CDN overhead for no real privacy gain.
- `phone` is never exposed via a blanket table grant to any role — it's read only through the `gifvtme_get_own_phone()` RPC, because the `users` table's SELECT RLS policy is shared with a broader "can read this profile" check used for buyer/receiver visibility, not owner-only like a naive column grant would assume.

## Problems solved

- Recurring issue this session: uncommitted local edits to exactly four files (`gifvtme_migration_008_profile_management.sql`, `app/account/profile/page.tsx`, `context/architecture/DATABASE_SCHEMA.md`, `context/ROADMAP.md`) were discarded at least twice — visible in `git reflog` as `reset: moving to HEAD` entries interleaved with `git pull` bringing in the CodeRabbit commits from `origin/profile-management`. Root cause not confirmed — possibly another concurrent session/process on the same branch, or an IDE-triggered reset. Each time, the fix had to be reapplied from scratch since it only existed as uncommitted working-tree state.
- Lesson: after this kind of external-reset surprise, verify actual on-disk content (`grep`) rather than trusting `git status`/`git diff` alone immediately after — at one point disk content and `git status` briefly disagreed with what a stale system notice implied, and the only way to be sure was to grep the real file and check `git log`/`git reflog`.

## Current state

- Branch `profile-management`, HEAD is `834627e`. Migration 008 and `page.tsx` have the phone-RPC security fix committed. `DATABASE_SCHEMA.md`/`ROADMAP.md` describe it accurately.
- Migration 008 has **not** been applied to the actual Supabase project yet. If an earlier (vulnerable) version of the migration was ever run there manually, run `REVOKE SELECT (phone) ON public.users FROM authenticated;` before re-running the current file — removing a `GRANT` line from the script doesn't retroactively revoke an already-applied privilege.
- `context/feature-specs/` is still being actively rewritten by what looks like a concurrent, unrelated process (renumbered files 06–20, new files like `12-THANK-YOU-MESSAGES.md`, `20-ADDRESS-BOOK.md` appearing as untracked mid-session). Intentionally left alone all session — not part of this work.
- `tsc --noEmit` and `eslint` pass clean on all touched files as of the last check.

## Next session starts with

Run `/remember restore`, then verify `gifvtme_migration_008_profile_management.sql` and `app/account/profile/page.tsx` still contain the phone-RPC fix (`grep -n "gifvtme_get_own_phone"` both files) before assuming committed state is stable — this session's own edits were silently reset twice. Then ask the user whether migration 008 has been applied to Supabase yet, and whether the `REVOKE` step is needed. Consider investigating what's driving the repeated resets and the ongoing `context/feature-specs/` churn if it's still happening.

## Open questions

- Why were local edits to those four files reset at least twice this session — is another process/session working the same branch concurrently?
- Has migration 008 been applied to the Supabase project, and if an earlier vulnerable version was applied, has the `REVOKE` been run?
- What's driving the ongoing `context/feature-specs/` churn (new files still appearing mid-session)?
