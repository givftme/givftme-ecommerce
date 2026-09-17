# 0001. Platform model and light setup

**Date**: 2026-09-17
**Status**: In Progress

## Summary

Let people see useful gift ideas before asking them to create an account. Extend the existing application with Contacts, reliable date facts, consent aware reminder preferences, and a short path from discovery to a saved date. Preserve existing accounts, wishlists, and commerce while migrating their relationships safely. This is the build contract for scope feature 7, not an implementation or release approval.

## Structure

| File | Contract |
| --- | --- |
| [0001-experience.md](0001-experience.md) | Entry points, every screen and state, mobile behavior, reuse, and visual asset requirements |
| [0002-data-and-migration.md](0002-data-and-migration.md) | Canonical dates, Contacts, preferences, authorization, and compatibility migration |
| [0003-services-and-identity.md](0003-services-and-identity.md) | Interfaces, value sources, recommendations, import, authentication, and operational controls |
| [verify.md](verify.md) | Acceptance verification and release evidence |
| [rationale.md](rationale.md) | Alternatives, source attribution, confirmed session decisions, and inspection evidence |

Read the three child contracts together when building a slice. They share the requirements below. Names and numerical implementation defaults proposed by the architect remain reviewable in this Proposed spec; they are not represented as earlier user decisions.

## Requirements

**User stories**: As a giver, you can discover gifts before signup, save people and dates without knowing every detail, and control how reminders reach you. As an existing user, you retain your records and access. As a recipient, your account and wishlist privacy do not change because someone saved you as a Contact.

| ID | Acceptance criterion | Basis |
| --- | --- | --- |
| AC-1 | Anonymous `/dates` visitors enter name, relationship, and date, then request a target of three suitable suggestions before any auth requirement. After the approved fallback hierarchy, show only valid results available, including sparse or zero results with a discovery action. Neither suggestions nor their absence block saving. Birthday is a visible default; Different occasion reveals alternatives. No Contact, Occasion, reminder, or anonymous auth user is created before authentication. | Experience Design plus session, R-8 |
| AC-2 | Cold discovery asks relationship and date/occasion and requests a target of six ideas before signup. After fallback, show only valid results available; never fill the count with fabricated, unsuitable, duplicate, or unavailable products. Sparse/empty results preserve discovery and saving actions. Selecting a gift preserves context without making signup a purchase toll. | Build Specification and Experience Design plus session, R-8 |
| AC-3 | A minimal draft expires after 24 hours. Auth restores the journey. Automatic save requires an immutable operation ID bound to draft ID/revision/digest, a corresponding successful auth transaction, and its verified User. Atomic consumption and stored results prevent duplicate writes across replay, refresh, or lost responses. Conflicting tabs never silently overwrite drafts; account switches invalidate automatic save. Abandoned, invalid, missing, and expired drafts recover to review or Dates. Successful save and discard clear the draft. | Session and blocking R-4 correction |
| AC-4 | Saving atomically creates or reuses the owner's Contact and creates an Occasion after validation and duplicate checks. Retries do not duplicate either. Name suggestions require explicit selection; Add as a new person remains available. Conflicts offer existing records or legitimate separate events. | Session |
| AC-5 | Contacts may have zero or many Occasions. Missing imported or migrated information remains unknown. Optional verified account linking preserves the Contact ID and never expands wishlist access. Authorized shared context survives auth only through a protected, expiring capability reference that is revalidated for the current viewer; item IDs and `linked_user_id` never authorize access. Private settings and server managed evidence cannot be read or forged through ordinary profile/Data API grants. | Build Specification plus session, R-3, R-5 |
| AC-6 | Birthday day and month work without a birth year. Canonical February 29 remains unchanged, with February 28 as the effective occurrence in non leap years. Recurrence is explicit and calculated centrally without annual record duplication. One time events remain in history. | Session |
| AC-7 | Platform managed movable occurrences resolve by type, year, and owner region, initially Nigeria. No religious calendar engine is assumed. Unconfirmed future dates do not schedule speculative reminders; revisions invalidate future unsent schedules. | Session |
| AC-8 | Saving alone never grants notification consent. First save offers minimal setup; defaults and explicit occasion overrides remain distinguishable. Global opt outs and channel eligibility prevail. A confirmed valid giver IANA timezone and quiet hours govern reminder resolution. Missing/unconfirmed timezone leaves saving and suggestions available but prevents external reminder activation; neither server timezone nor Contact location is substituted. | Experience Design plus session, R-7 |
| AC-9 | Global reminder settings live at `/account/notifications`, reached from the account hub or occasion controls; individual occasion controls live in Dates. The dashboard shows truthful status. Channel fallback is restricted to consented, operational channels allowed for that stage. No eligible channel produces no external delivery and an accurate Dates state. | Session |
| AC-10 | Import becomes available only after authentication and a successful manual date save. Selected device contacts or CSV enter explicit consent and review; manual entry always works. Google Contacts and vCard are excluded. Reviewed Contacts may be saved without relationship/date. Imported date candidates require separate confirmation. | Session |
| AC-11 | CSV validation runs on the server with limits and individual row errors. Commit verifies per row integrity bound to owner, batch, row ID, payload digest and expiry. Edits require repreview; committed row IDs/payloads are immutable. Selected subsets and corrected failed rows can retry without duplicating prior successes. Unknown fields are not inferred and raw address books are not retained. | Session and R-6 |
| AC-12 | Suggestions prioritize accessible wishlist items and then real Sanity curation using relationship plus occasion, relationship, occasion, and broad suitable curation. Results identify fallback internally. Empty results never block saving. No invented products, stock, popularity, or private demand evidence appears. | Experience Design plus session |
| AC-13 | External gifts retain their origin, original URL, metadata, and currency context. They never enter catalog checkout. Reservations and purchase confirmation remain different actions. Stale metadata does not delete the item. | Repository boundary plus session |
| AC-14 | Phone OTP and Google can establish or add verified sign in methods while retaining one Givtme User. Identity conflicts do not merge accounts. Removing a method cannot remove the last usable method or delete account data. OTP is new infrastructure with a vendor independent boundary and explicit activation gate. | Build Specification plus session |
| AC-15 | Before the first personal Occasion write or backfill, verify live schema, private field privileges, and isolation of every legacy consumer/worker by purpose. Migration preserves references, recoverable facts, uncertainty, and consent without name based merging. Legacy wishlist behavior remains intact. Backfill respects durable deleted/retired source markers, so replay cannot resurrect deleted people/events or overwrite newer corrections. | Session and blocking R-1, R-2, R-3 corrections |
| AC-16 | Contact deletion atomically retires associated legacy sources, removes unnecessary provenance payload, deletes dependent personal data and stops reminders, without deleting linked users, wishlists, or commerce. Deleting only an Occasion preserves Contact. Mapping/receipt retention never blocks deletion or permits replay to recreate it. Confirmations state the affected records. | Session and blocking R-2 correction |
| AC-17 | All listed surfaces support keyboard use, small Android screens, slow connections, loading, empty, error, and success states. Condolence carries quiet content with no mascot, confetti, badges, or streak pressure throughout the journey. | Experience Design |
| AC-18 | Operational outcomes distinguish save failure, saved but suggestions unavailable, reminder eligibility, delivery failure, skipped delivery, and fallback. Analytics omit personal draft/contact content, secrets, and shared access tokens. | Build Specification plus session |
| AC-19 | `/account` is an authenticated account hub with navigation to `/account/profile`, `/account/orders`, `/account/notifications`, and `/account/security`. Existing profile and order behavior and order detail links remain available in their nested routes. Sign out is an action in the account experience, not a page. No Delete Account action, dialog entry, delete account route, or destructive account section is exposed in this release. | Revised session decision |

## Decision

**Chosen option**: Extend the existing application through compatible, gradual migration and shared domain services. Keep Next.js, React, TypeScript, Supabase identity/database boundaries, Sanity content, and existing UI primitives. No new auth platform, recommendation engine, calendar provider, or SMS vendor is selected.

**Implementation skills**: `.agents/skills/supabase/SKILL.md`, `.agents/skills/supabase-postgres-best-practices/SKILL.md`; the installed `sanity-best-practices` skill informed content boundaries. Existing styling conventions remain governed by `components/AGENTS.md` and `ui-registry.md`.

**Approach**: Tracer Bullet, as recorded in `docs/scope/scope.md`. Build a working vertical path first, then add richer identity, imports, and calendar behavior. The workflow tier is Beta; privacy and identity changes need explicit verification.

### Scope and adjacent features

This feature owns first date discovery, persistence, Contacts, date resolution, migration, reminder preference UI and eligibility interfaces, phone identity setup, and catalog curation for suggestions. It also owns adapting legacy scheduling entry points so saving no longer silently opts people in.

It also restructures Account navigation: `/account` becomes the hub, existing profile and order screens remain under their nested routes, and notifications/security complete the settings destinations. Remove the current Delete Account UI from the release contract without changing the Contact/Occasion deletion requirements or independently retained commerce data. No account deletion route or replacement destructive account section is part of this feature.

Feature 4 owns the actual reminder dispatcher, channel integrations, stage timing, fallback order, recovery policy, and delivery retries. It must consume this spec's dates, consent, timezone, and revision contract. Its ladder is T-30 for milestones, T-7 requesting a target of three suitable ideas after truthful fallback and wishlist priority, and T-1 with verified same day options, with a strict cap of three messages per occasion occurrence across channels. T+1 is not an authorized fourth message. New reminder activation requires the compliant dispatcher; do not describe the current 14/3 day email implementation as compliant.

Feature 3 owns shared access migration, claims, share cards, and private projection hardening. Feature 5 owns external metadata ingestion and currency migration. Feature 9 owns guest checkout, prices, and delivery promises. Feature 8 owns durable referral reporting; this feature supplies events. Feature 10 owns fulfilment and reveal. Their interfaces are required dependencies where used, not permission to implement those entire features here.

Keep current public wishlist viewing and separate catalog/external actions working. A missing guest checkout or secure sharing dependency is a visible release gate for the affected journey, never a reason to introduce a new auth wall or expose private data.

### Proposed engineering defaults

The child specs state concrete defaults for draft storage, API paths, CSV limits, OTP limits, and data constraints. Unchanged numerical defaults remain architecture recommendations for review, distinct from confirmed product decisions. R-1 through R-4 are mandatory architecture corrections authorized in this session, not implementation TODOs. Their mechanisms are specified in the child contracts and their verification precedes personal data rollout. Physical migration DDL must be checked against the deployed schema before execution; repository migrations are incomplete evidence of live structure.

## Build plan

| Slice | Work and completion evidence | Criteria |
| --- | --- | --- |
| 0. Blocking compatibility and authorization prerequisites | Inspect live schema/consumers and rehearse recovery before schema rollout. Establish private settings/projections and server managed field grants before new sensitive fields become readable/writable. Deploy and verify purpose guards for every legacy list/detail/mutation/archive/reminder consumer. Establish deletion markers and serialized backfill/delete behavior. Prove bound continuation/operation consumption in an isolated environment. Keep personal Occasion writes and backfill disabled until these checks pass. | AC-3, AC-4, AC-5, AC-15, AC-16 |
| 1. First working path | After slice 0, enable canonical date fields, Contact persistence, and atomic save behind a rollout flag. Move `/dates` outside the protected dashboard layout while retaining authenticated APIs. Ship manual birthday entry, real suggestions with target three and sparse/empty recovery, Google/existing auth return, temporary draft/capability restoration, save success, and timezone aware reminder eligibility as one tested path. No generated artwork is required. | AC-1, AC-3, AC-4, AC-5, AC-8, AC-12, AC-17, AC-18 |
| 2. Preserve existing users | Use the already verified compatibility boundary to dry run mappings and backfill in batches. Prove deletion markers defeat replay, protect legacy wishlist/reminder references, and enable uncertainty correction UI. Complete Contact reuse, conflicts, deletion, history, and compatible legacy writes. | AC-4, AC-5, AC-6, AC-15, AC-16 |
| 3. Complete dates and preferences | Add culturally specific taxonomy, canonical recurrence, configured regional occurrences, timezone/region settings, global and occasion reminder controls, revision invalidation, and durable rescheduling requests consumed by feature 4. Prove suppression when consent or delivery capability is absent. | AC-6, AC-7, AC-8, AC-9, AC-17, AC-18 |
| 4. Complete discovery | Add cold landing target six journey with sparse/empty recovery, relationship and feeling curation, accessible wishlist priority, safe external actions, and truthful evidence slots. Verify protected capability restoration and expiry/revocation during auth. Validate sharing and guest handoff dependencies. | AC-2, AC-5, AC-12, AC-13, AC-17 |
| 5. Import people | Add post save import, selected device adapter, CSV template/parser, consent/review, server validation, per row signed preview evidence, repreview edits, immutable committed receipts and partial retries, enrichment, and separate date confirmation. | AC-5, AC-10, AC-11, AC-17, AC-18 |
| 6. Account hub and sign in methods | Make `/account` the hub, connect the four nested routes, preserve profile editing and order list/detail behavior, keep sign out as an action, and remove Delete Account from the rendered UI. Implement the vendor independent phone boundary and account linking UI, select/configure the provider during implementation, verify Nigeria delivery, harden abuse controls, and prove conflict and last method protections with the actual auth project. | AC-3, AC-14, AC-17, AC-18, AC-19 |
| 7. Release verification | Execute `verify.md`, test migrated and new accounts, inspect mobile and low bandwidth behavior, validate data isolation and race cases, update README, environment examples, and UI registry as relevant to the built result. | AC-1 through AC-19 |

## Consequences

You gain a short discovery path and a stable person/date model without replacing the store. Explicit provenance and consent allow safer migration and correction.

The cost is temporary compatibility code, platform calendar maintenance, more failure states, and coordination with the reminder and sharing features. Existing data may not recover original birthday facts. SMS delivery and live database configuration cannot be certified through repository inspection.

## Follow-up

1. Select and verify the phone OTP delivery provider during implementation. It is required for completion of AC-14, not for writing the domain model.
2. Obtain compliant feature 4 delivery before enabling new reminder sending. Until then, distinguish preferences saved from reminders active.
3. Complete feature 3 authorization before enabling linked wishlist discovery against any unsafe legacy projection.
4. Produce approved cultural occasion and emotional state assets from the inventory in `0001-experience.md`; do not invent styling during architecture.
5. Confirm runtime schema, recovery backups, existing auth hooks, and provable consent sources before migration. Do not execute destructive migration from this document alone.
6. Ratify the Proposed spec and decide whether to run the optional independent completeness check. No scope lifecycle advancement is implied by the approved logical model.

## Rationale

Reasoning, source precedence, and session decisions: see [rationale.md](rationale.md).
