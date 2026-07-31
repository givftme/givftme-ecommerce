# Memory — Wishlist Sharing Spec Reconciliation

Last updated: 2026-07-30

## What was built

- `context/feature-specs/07-WISHLIST-SHARING.md` described visibility/sharing/invites as if largely unbuilt, but it was ~90% already shipped under migration 006 ("sharing and giver flow") — `ShareSettingsSheet.tsx`, the invites API routes, and `gifvtme_get_shared_wishlist()`. Per [[feedback-spec-vs-architecture-precedence]], surveyed shipped code first (via an Explore subagent) instead of implementing the spec literally, found the shipped design deliberately diverges from the spec in several ways (no `share_token` column — wishlist `id` doubles as the public share key; hex invite tokens not UUID; email-**or-phone** invites not email-only; WhatsApp share not Web Share API). Presented the conflict and the real remaining gaps to the developer; developer chose "close real gaps only, document shipped reality" over a literal spec rewrite — same call as the prior catalog-item-wishlist session.
- Closed the one real gap: **signup-time `invitee_user_id` backfill**. Added `gifvtme_migration_012_invite_backfill_on_signup.sql` — a standalone `AFTER INSERT ON auth.users` trigger (`gifvtme_backfill_invitee_on_signup_trigger` → `gifvtme_backfill_invitee_on_signup()`) that matches pending `wishlist_invites.invitee_email` against the new user's email. Deliberately implemented as a *second, independent* trigger rather than editing `handle_new_user` — that function's live SQL body isn't in this repo (migration 001 was applied directly to Supabase and never committed), so editing it blind risked silently dropping unknown existing logic.
- Rewrote `07-WISHLIST-SHARING.md` section-by-section to document shipped reality (token format, invite-by-phone, id-as-share-key design, `autoAcceptInvite`-on-view behavior, the `gifvtme_wishlist_invites_public_self_insert` RLS policy backing public-wishlist reminder opt-in, etc.), matching the correction style used for `06-CATALOG-ITEM-WISHLIST.md` last session.
- `context/architecture/API_ROUTES.md` needed no changes — it was already accurate for all the sharing/invite endpoints (verified by grep before assuming a gap).
- Updated `context/ROADMAP.md`: added migration 012 to the "Done but must still be applied to Supabase" list, alongside 003/006/007/008/011.
- No commit made yet — developer has not asked to commit this pass.

## Decisions made

- Confirmed (third time now, across catalog-item-wishlist, then this session) that shipped/architecture-documented code wins over a literal feature-spec rewrite by default in this repo — [[feedback-spec-vs-architecture-precedence]] is a load-bearing, recurring pattern, not a one-off judgment call.
- When a DB trigger needs extending but its live definition isn't checked into the repo (migration 001's `handle_new_user`), prefer adding a new, independent trigger over blind-rewriting the unknown function — avoids risking silent loss of existing logic that can't be diffed against.
- Public share links intentionally use the wishlist's own `id` as the share key rather than a separate `share_token` column — simpler, already works, no reason flagged to change it.

## Problems solved

- None novel — this session's shape (spec describes something already shipped differently) is now a recognized pattern, not a fresh problem each time.

## Current state

- On `main`, one new untracked file (`gifvtme_migration_012_invite_backfill_on_signup.sql`) plus modified `context/feature-specs/07-WISHLIST-SHARING.md` and `context/ROADMAP.md`. Not committed.
- `tsc --noEmit`, `eslint`, and `npm test` (27/27) all clean.
- `gifvtme_migration_012_invite_backfill_on_signup.sql` has **not** been applied to the Supabase project (no DB access from this environment) — same unconfirmed-application state as migrations 003, 006, 007, 008, 011.
- Open question raised to the developer but not yet answered: whether to eventually reconcile this new trigger into `handle_new_user` properly once its live Supabase definition can be pulled, versus keeping it as a permanent second trigger.

## Next session starts with

Run `/remember restore`. Ask the developer:
1. Whether to commit the migration 012 file + doc updates now.
2. Whether migrations 006/011/012 have been applied to the Supabase project yet (recurring open item across sessions — consider resolving definitively rather than re-asking each time).

## Open questions

- Whether the signup-backfill trigger should stay a permanent standalone trigger, or get folded into `handle_new_user` once its live definition is retrievable from Supabase directly (`pg_get_functiondef`).
- The broader "is migration N applied to Supabase yet" question keeps recurring across sessions (003, 006, 007, 008, 011, now 012) with no resolution mechanism — worth the developer setting up a way to track this (e.g. a `schema_migrations` marker table, or just applying the backlog) rather than it staying an open question indefinitely.
