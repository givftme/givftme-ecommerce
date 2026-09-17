# Data and migration contract

## Summary

Keep person identity, saved occasions, effective occurrences, and permission to send reminders separate. Extend existing user and occasion storage, preserving legacy IDs through explicit mappings. Physical names below are architecture recommendations; verify deployed constraints before generating a migration.

## Target model

`uuid` identifiers, calendar `date` values, and UTC `timestamptz` audit values follow existing Postgres conventions. Date only facts must not be parsed as an instant in the server's timezone. Every mutable record carries `created_at`, `updated_at`, and a revision used to detect stale edits. No new money columns or currency conversion are introduced.

| Record | Key and relationships | Required data | Nullable or conditional data |
| --- | --- | --- | --- |
| Existing `users` | Retain existing ID and auth mapping | Existing public profile fields/grants only | Do not add the new private settings or server managed onboarding marker to the counterparty readable profile projection |
| `user_private_settings` | One owner only row per existing User | Region defaults to `NG`; settings revision | Nullable IANA `timezone`, `timezone_confirmed_at`, locale; `first_manual_date_saved_at` set by successful manual save or reliable migration evidence. These are User settings logically, but stored separately from shared profiles |
| Provider authentication identities | Managed by existing authentication provider; many verified identities to one auth user/Givtme user | Stable provider subject and verification status supplied by provider | No custom password or OTP secret table; provider identity is distinct from Contact phone/email |
| `contacts` | `id`; `owner_user_id` references existing User; `linked_user_id` nullable references User with unlink on account removal | Owner and at least one explicitly supplied usable name, phone, or email; `source` manual/device/csv/legacy | Name when absent in import; relationship key and optional custom label; phone/email; avatar; notes; interests; link evidence and verification time. Manual first date requires a name and selected relationship in its input schema |
| Extended `occasions` | Retain existing ID; existing `user_id` is owner; nullable `contact_id`; same owner constraint for linked Contact | `purpose` personal_date or wishlist; explicit `occasion_type`; `recurrence_mode`; status active/archived; `date_confidence` confirmed/legacy_uncertain; revision | Canonical month/day and optional source year; one time `event_date`; managed calendar key; event label; manual milestone flag; original fact provenance; derived next date cache with revision; legacy title/date fields kept during compatibility |
| `platform_occurrences` | `id`; unique calendar key, occurrence year, region key | Key, year, region, status unresolved/provisional/confirmed, revision | Date only when known; source note, confirmed by/time. A provisional date is not a confirmed reminder anchor |
| `notification_preferences` | One owner only row per User | Global enabled state, ordered permitted channel preference, inheritance revision | Quiet hours start/end; absent means none chosen, not consent. Timezone comes from `user_private_settings`; no Contact timezone |
| `channel_consents` | Current state unique by User and channel; audit events carry separate IDs | State unknown/granted/withdrawn; source new_user_choice/legacy_evidence; revision | Timestamp and evidence reference when known; do not invent legacy consent time; verified delivery destination references come from channel adapters |
| `occasion_reminder_preferences` | One row per Occasion | `mode` inherit/off/custom | Custom enabled/channel order/quiet hours when explicitly set; omitted fields inherit user values, never erase global prohibitions |
| `legacy_record_mappings` | Unique source table plus source ID | Source owner; migration version; state active/retired; confidence | Live target Occasion/Contact foreign keys nullable with `ON DELETE SET NULL`, never cascade delete the mapping; restricted provenance is scrubbed on deletion |
| `deletion_tombstones` | Unique owner plus resource kind and original resource ID; source suppression entries keyed by legacy table/ID | Deletion time/revision and reason code; durable source retirement | No names, dates, phone/email, notes, or snapshots; survives deletion of target resources |
| `save_operations` | Globally unique server issued operation ID; immutable owner once authenticated | Draft ID/revision/digest, state bound/committed/conflict/cancelled/deleted, result IDs and timestamps | Live result foreign keys become null on deletion; retain opaque original IDs/status for replay response, never recreate deleted results |
| `import_operations` and row receipts | Owner plus server issued batch ID; unique batch plus stable source row ID | Source, consent timestamp/version, canonical payload digest, preview revision, row outcome and timestamps | Contact reference nullable on deletion plus deleted outcome; no retained raw file or unselected row content |
| Temporary journey state in a private schema | Browser session secret hash plus draft ID; one current revision and tab editor identity | Expiry, minimal encrypted draft, immutable pending operation ID, auth attempt binding and state | At most 24 hours; nullable verified User binding after authentication. No anonymous auth user or saved Contact/Occasion; see services contract for atomic continuation |
| Temporary shared capability | Random reference bound to journey/draft, later to verified viewer | Expiry, scope, access revision and protected source capability or existing grant reference | Encrypted bearer material where required; no public projection or implied permanent grant; removed at expiry/discard/success, except the bounded scoped handoff transfer specified in the services contract |
| Rescheduling outbox | Unique source identity plus source revision | Owner/Occasion or global invalidation reference, reason, revision, pending/processed status | Retry state; consumed by feature 4, contains no plaintext draft or OTP |

Saved date Occasions normally require a Contact. Existing wishlist Occasions remain valid with `contact_id = null`; do not impose a global nonnull constraint. Shared ownership checks apply whenever a Contact is attached. A wishlist occasion is not automatically a personal reminder subscription.

Missing personal facts are nullable. Empty display names on import use a neutral UI label based on the supplied identifier, never a fabricated stored name. Interests and notes are owner private and are never public recommendation metadata.

### Canonical date representations

Exactly one active date representation applies:

| Recurrence mode | Canonical representation | Resolution |
| --- | --- | --- |
| `annual_fixed` | Month 1..12, valid day, optional original year | Resolve in the owner's current local year, advance to the next year only after the occurrence's local day has passed. February 29 resolves to February 28 only in non leap years |
| `once` | Complete event date | Preserve after passing; no next annual occurrence and no automatic new record |
| `managed_movable` | Platform calendar key, with region from owner settings | Resolve confirmed `platform_occurrences` for the relevant year/region. Do not add a Gregorian year or silently use another region |

`occasion_type` determines an initial recommendation, not a hidden ongoing recurrence rule. Birthday and anniversary default annual. Life events default once. Custom occasions expose an explicit annual/once choice after initial ideas and before final save if needed. Legacy ambiguous canonical fields may remain null with `legacy_uncertain`; new manually entered values must validate. A year supplied for a birthday is the birth year, never the current or next occurrence year.

The shared resolver in `lib/occasion/` takes canonical facts, recurrence, owner timezone/region, current instant, and confirmed platform calendar data. It returns occurrence date, local day difference, occurrence key, date source/revision, and resolved/awaiting_confirmation/needs_correction/passed/timezone_required status. It does not write canonical facts. UI, APIs, analytics, and feature 4 use this resolver rather than separate arithmetic.

An occurrence key identifies the saved occasion and annual occurrence year (or one time event identity); calendar date revisions do not reset that occurrence's message count. Timezone or region changes invalidate future unsent schedules. Already sent outcomes remain history. The dispatcher must recheck the current revision and permission immediately before sending.

### Taxonomy and milestone data

Extend the shared domain vocabulary and Sanity curation mapping to birthday, anniversary, introduction, traditional wedding, white wedding, naming ceremony, Omugwo, graduation/convocation, NYSC passing out, new job, promotion, housewarming, new car, Japa send off, Eid al Fitr, Eid al Adha, Christmas, Valentine's, Mother's Day, Father's Day, Children's Day, Detty December, condolence, and custom. Preserve legacy wedding, baby shower, graduation, and other values with explicit aliases and display labels; do not guess a wedding stage from `wedding`.

Use stable keys independent from presentation labels. Existing `sallah` data without a known subtype requires confirmation; do not guess which Eid it refers to. Regional movable observances other than Sallah can reuse managed occurrence configuration rather than being incorrectly treated as fixed dates. A season such as Detty December needs an explicit chosen planning date, not an invented exact day.

Milestones are either explicitly marked by the owner or derived from a known original year and a configured milestone rule. Do not invent ages or an automatic milestone age list in this feature. Until feature 4 ratifies an automatic rule, only an explicit milestone flag qualifies for T-30. Unknown birth year does not disable the ordinary birthday journey.

### Ownership, indexes, and duplicate rules

Enable row level security on all exposed personal tables and grant only necessary operations. Owner reads/writes require the authenticated User; inserts and updates check that ownership cannot be reassigned. Do not authorize from editable auth metadata. Nonowned IDs return the same 404 as missing records. Index owner foreign keys, owner/name lookup, Contact/occasion relations, owner/next occurrence, mapping source keys, and pending outbox work. Do not make names globally unique.

### Private projections and field privileges (R-3, blocking)

The existing `users` profile read policy admits gift/purchase counterparties. Preserve that policy's limited display purpose; do not widen profile column grants to include timezone, region, onboarding state, consent, or link evidence. Add `user_private_settings` and the field boundaries below before any new private value is exposed. A profile counterparty has no access to these settings even though they can read selected profile fields.

| Data | Read boundary | Write boundary |
| --- | --- | --- |
| Existing public profile | Existing explicitly permitted display fields and policies only | Preserve existing safe profile edit grants; no grant widening as part of this migration |
| Private timezone/region/locale, notification defaults, occasion overrides | Owner only projection, never counterparties/anonymous | Validated authenticated service operations; no blanket direct Data API UPDATE grants |
| `first_manual_date_saved_at` and timezone confirmation provenance | Owner may see completion/effective zone status, not arbitrary internal evidence | Server sets onboarding marker inside successful save transaction; server stamps timezone confirmation after explicit owner action |
| Contact and Occasion ordinary fields | Owner only; public wishlist data uses its separate authorized projection | Validated domain mutations for ownership, duplicate checks, revisions, delete markers and outbox. Direct table INSERT/UPDATE/DELETE is revoked for new model tables |
| `linked_user_id`, linkage evidence, verification and date confidence provenance | Owner receives permitted linked identity/status; raw evidence is private service data | Only verified link/migration/correction services set them; an owner cannot PATCH arbitrary evidence or linked IDs |
| Channel consent state/provenance, destination verification | Owner sees their settings/status; raw provider/evidence references stay server private | Consent endpoint records explicit permitted changes, server timestamps and verification evidence; no client chosen provenance |
| Mappings, tombstones, operation receipts, outbox | Private schema/service only; bounded owner result endpoints project safe status | Controlled transactions and workers only; no anon/authenticated table writes or arbitrary RPC execution |
| Temporary drafts, capabilities and auth attempts | Only journey service after secret/session and binding validation; no Data API grants | Journey service with expiry, revision, auth binding, and CSRF checks |

Revoke inherited/public function execution where necessary. Privileged functions validate the actual caller and all ownership relations; never accept body `owner_user_id` as authority. Server only credentials stay out of browser clients. Any service using privileged database access repeats authorization explicitly. Tests exercise direct Data API and RPC attempts, not only protected routes.

Birthday uniqueness is per owner and Contact for an active birthday. Before creating, also inspect equivalent archived birthdays and offer reactivation. Add database uniqueness only after legacy duplicates have been preserved and resolved or explicitly isolated; never discard data to make an index succeed.

For other events, type alone is not identity. Compare Contact, type, date or managed calendar identity, and explicit event label where present. Return a potential conflict with owner visible existing IDs; an explicit separate event resolution can bypass a soft ambiguity warning, but not the active birthday constraint. A save transaction locks the selected Contact or equivalent ownership key, reruns conflict checks, and creates both records together. Concurrent birthday saves return one saved result and one conflict. Repeated identical operation IDs return the original result; changed payload under the same key returns 409.

Selecting an existing Contact preserves relationship, linked user, notes, and interests. Occasion input does not implicitly patch those person fields. Name similarity provides owner scoped suggestions only. No account or contact consolidation uses names as identity evidence.

## Reminder preference resolution

1. Global disabled means no external reminders for any occasion. Global channel withdrawal or lack of consent excludes that channel regardless of an override.
2. An occasion set to off suppresses it. Inherit uses current defaults; custom overrides only explicitly supplied behavior within permitted channels.
3. Eligibility additionally requires a valid confirmed timezone in `user_private_settings`, verified destination/permission, operational channel configuration, current confirmed occurrence, and stage availability.
4. Quiet hours use the reminder recipient's IANA timezone. Custom quiet hours may narrow permitted delivery times, not bypass the user's global quiet hours. Changes create rescheduling invalidations.
5. First reminder enablement sets defaults with separately recorded channel consent. Later saves inherit them without asking repeatedly. Declining first setup preserves the date and leaves reminders disabled/unknown.

Persist preference changes and the rescheduling request in one database transaction. A failed dispatcher does not roll back the preference or falsely mark delivery active. Global disable and withdrawal must take effect at send time even if queue cleanup is delayed. Feature 4 specifies send times, DST handling, catch up rules, stage fallback order, retries, and the three message budget before delivery activation. This spec does not invent those policies.

### Unresolved timezone (R-7)

Saving a Contact/Occasion and fetching ideas never require a confirmed timezone. A valid browser detected IANA zone is a suggestion, not a confirmed User setting. During reminder setup show it explicitly and record confirmation with the user's action; otherwise offer a searchable zone choice. Until a valid zone and confirmation provenance exist, effective reminder status is `timezone_required` and no external schedule is activated. Preserve consent/preferences already supplied without claiming activation.

Reliable explicit legacy timezone settings may migrate as confirmed with their evidence; otherwise leave confirmation absent. Do not derive timezone from Nigeria region, a fixed UTC offset, server locale, IP, or Contact location. Invalid/unavailable stored zones suppress future unsent delivery until corrected. A newly selected valid zone is confirmed by the settings save and invalidates future schedules.

For anonymous or unconfirmed preview, the browser may supply a validated IANA zone used only for provisional display with server current time; label the zone as a preview, not reminder configuration. If unavailable, show entered calendar facts and resolved configured event date without relative countdown/next occurrence claims requiring a local day. Once authenticated and confirmed, the resolver uses stored private settings. The resolver returns `timezone_required` when authoritative local day calculations lack that input.

## Contact linking and deletion

This section governs saved Contacts and Occasions, not deletion of the signed in user's Givtme account. The revised Account UI exposes no Delete Account action or route in this release. Existing account/order data and ownership references remain intact; moving order navigation into the account hub requires no data migration.

For this release, recommend explicit linking from an authorized shared wishlist/invitation context. Resolve the actual owner through the access service, show the permitted account identity, and require the Contact owner to confirm this is the intended person. Never accept a raw client supplied `linked_user_id` as proof or search accounts by Contact phone/email/name. Linking stores evidence of the explicit action, not a permanent wishlist access grant. Access is rechecked for each recommendation and click; revocation removes the suggestion. Future verified identifier matching fits the same evidence boundary but is not enabled by importing identifiers.

Deleting a Contact first marks the dependent personal occasions ineligible inside the transaction, deletes their personal reminder/occasion records, and removes the Contact. Enqueued workers must tolerate missing source records and recheck eligibility. Preserve linked User and independently owned wishlists and commerce. If a legacy wishlist occasion was explicitly associated with the Contact, detach that association and cancel only the personal reminder subscription; preserve the independently owned wishlist occasion and its references. Do not use a broad cascade that destroys a receiver's wishlist.

Deleting just an Occasion preserves its Contact and any independent wishlist/order evidence. Offer removal of a now empty Contact as a separate explicit action. The confirmation includes the current count of dependent personal occasions. A revision conflict refreshes that count before deletion. Sent delivery records, consent provenance, and migration receipts must not retain unnecessary deleted contact payloads; operational receipts may retain opaque IDs and outcome codes only under the application's documented retention policy. No new legal retention duration is inferred here.

### Durable deletion and replay (R-2, blocking)

Deletion and migration share a serialization lock for the owner/source set, with source keys locked in a stable order. Under that lock, deletion marks every affected mapping retired, writes resource and legacy source tombstones, cancels future work, scrubs contact/date snapshots, and deletes dependent personal rows in one transaction. Backfill acquires the same lock and checks retirement immediately before any insert/update. Thus either a backfill finishes first and deletion removes its result, or deletion finishes first and backfill skips the source. A missing target is never sufficient reason to recreate it.

For Contact deletion, retire every mapped personal date source attached to that Contact. Keep a legacy wishlist occasion mapping active when its independent wishlist must survive, but persist an association tombstone preventing replay from reattaching the removed Contact. Occasion only deletion retires just its mapped source and preserves the Contact. Write paths cannot clear a tombstone as a side effect of retry or migration. Intentional recreation requires a new explicit user operation and new record identity; it does not revive the retired source.

Mappings and receipts have nullable live foreign keys with `ON DELETE SET NULL`; no restrictive target foreign key may block an authorized delete and no target deletion cascades away the suppression record. Preserve only opaque original resource/source IDs, owner linkage, revision/time and outcome after scrubbing personal snapshots. Save/import retry after deletion returns a safe `result_deleted` terminal status, not an insert or stale success suggesting the person still exists. This applies to new records without legacy sources as well as migrated ones.

Retain tombstones while any legacy source, replayable backup/import, or compatible writer can recreate the resource. They are not expired with anonymous drafts or ordinary retry windows. Decommissioning requires evidence that all such replay paths are retired; until then the tombstones remain. Restoring a backup requires reapplying the deletion ledger before opening writes or sending reminders. Retired source payload is erased or rendered inert through the controlled compatibility layer; rollback must not reexpose it as live data.

## Migration plan

**Strategy**: Add compatible fields and ownership links, backfill with evidence, route through shared adapters, then retire legacy writes after verification. Never replace the whole database or rename public routes as a side effect.

### Prerequisite gate before personal Occasion writes (R-1 through R-4)

Personal writes and backfill stay disabled until live schema inventory, private grants, purpose isolation, tombstone serialization, and operation binding are deployed and verified. Apply this to test rollout/cohorts as well as production activation; the first vertical slice is not exempt.

Inventory every consumer of `occasions`, including `getOccasionSummaries`, receiver detail/ownership checks and mutations in `lib/occasion/server.ts`, occasion wishlist creation, manual archive/reactivation, `app/api/occasions/archive/route.ts`, reminder scans, triggers/RPCs, and any operational tooling discovered in live inventory. Establish `purpose = wishlist` for existing receiver records and explicit `purpose = personal_date` for new/migrated personal dates. Receiver lists/details/actions and their workers accept only wishlist purpose. Personal handlers accept only personal purpose except an explicit compatibility operation for an already authorized legacy association. A receiver URL for a personal ID returns unavailable even to its owner, not a new receiver projection.

Deploy archive worker purpose filters before inserting a personal row. The legacy archive cutoff must not archive annual personal events or run reactivation logic for them. Block legacy workers from rewriting canonical date facts. Update table constraints, trigger behavior and exactly one reminder source rules coherently before cutover. If a consumer cannot be isolated, stop/disable it before writes; a rollout flag on the new UI alone is insufficient.

Prove with fixtures that receiver wishlist behavior still works and a personal annual event with a past legacy display date neither appears in receiver lists nor changes in the legacy archive pass. Verify direct data privileges and tombstone/continuation race tests. Only then enable the first personal save path. Backfill follows the same already installed guards.

1. Inspect deployed User/auth linkage, `important_dates`, `occasions`, wishlist foreign keys, reminder source checks, triggers, policies, and historical consent evidence. Take a recoverable snapshot and rehearse on a copy. The repository starts after some original tables existed; its migrations do not establish the complete deployed schema.
2. Add Contacts, canonical occasion fields, preferences, mapping/operation records, and outbox structures without destructive constraints. Relax legacy occurrence date requirements only as needed for yearless birthdays and unresolved managed dates, using explicit tagged representation constraints instead of placeholder dates.
3. After the prerequisite gate, for each `important_dates` row acquire the migration/delete lock and inspect its source retirement and resource tombstones. Skip retired sources. For active sources, find or create one mapping and a same owner Contact unless reliable identity evidence supports reuse. Create the canonical personal Occasion and retain the old date ID mapping. Reuse UUIDs only if collision free; mapping, not UUID equality, is the guarantee. Preserve linked wishlist references as references, never proof of Contact identity or ongoing access.
4. Existing legacy wishlist `occasions` rows keep IDs and wishlist relationships. Their purpose was established as wishlist in the prerequisite gate; verify it through legacy source inventory rather than bulk reclassifying new personal rows, preserve display and archive behavior, and leave Contact null unless reliable data or explicit user action establishes it. Their existing create with wishlist transaction remains separate from the new save personal date operation.
5. Recover original date facts only from reliable original input/history evidence. A known advanced occurrence is not a birthday fact. Keep restricted legacy value/provenance, flag uncertain records, and present Confirm original date. In particular, February 28 may be an original birthday or a transformed February 29; do not choose between them without evidence. Legacy occurrence years do not become birth years. Uncertain canonical dates do not drive new automatic recurring schedules until corrected; the old displayed date may remain clearly labelled for continuity.
6. Transfer recurrence only when its legacy meaning is established. Preserve contradictions for review rather than silently converting one time events to annual. Missing relationships and all unsupported personal facts remain null. Proven email opt in migrates only to email; explicit opt outs stay disabled. A scheduled job or saved date is not consent evidence. Owner unsubscribe currently deletes rows without a durable preference, so absent rows cannot prove consent in either direction.
7. Route legacy date reads/writes/links through the compatibility adapters installed by the prerequisite gate. Migrate reminder references and exactly one source checks coherently. Honor retired sources on every path, never return tombstoned data as live, and never run both old and new schedulers for one occurrence.
8. Backfill in bounded batches under source serialization with unique mappings and revision checks. Replaying returns the same active mapping or a retired/skipped outcome, never recreates deleted targets, and does not overwrite user corrections or newer consent. Compare counts including retired sources, ownership, references, uncertainty and samples. Retry interrupted batches safely.
9. Enable cohorts through server controlled rollout flags after rehearsed rollback and verification. Pause new reminder delivery for migrated cohorts until the feature 4 adapter and permission checks are ready. Expose truthful setup state. Preserve consent evidence while paused.
10. Retain old columns and mapping until all callers and workers use the canonical adapter and the rollback window has closed. Retiring them requires a separate reviewed migration; this spec does not authorize deleting historical data during backfill.

Account route compatibility is a UI migration: keep `/account/profile`, `/account/orders`, and `/account/orders/[id]` destinations and their ownership checks. `/account` becomes the hub rather than redirecting to order history. Preserve old order detail links; update navigation that intends to show orders to target `/account/orders`. Removing Delete Account from the UI does not delete account records or introduce a new account deletion route.

**Rollback**: Disable new writes and delivery for the affected cohort, drain/stop conflicting workers, and route compatible reads through preserved mappings. Retain purpose/private field guards and the deletion ledger; retired data stays suppressed. Keep new Contacts, canonical facts, and preference withdrawals. Do not roll back to a worker that ignores consent or resume writing derived dates over original facts. New yearless/movable records cannot be faithfully represented in the old schema; preserve them in the new store and show read access while repair proceeds. Database restore requires deletion ledger reconciliation before access resumes and is a last recovery action, not the default rollout switch.

**Risks**: Incomplete legacy provenance, unknown live triggers, duplicate birthdays, destructive existing cascades, concurrent backfill/user edits, and stale worker jobs. These require the migration and concurrency cases in `verify.md`, not assumptions about existing tests.

## Rationale

The approved logical model separates facts from occurrences and people from accounts. Extending existing occasion storage and retaining mappings avoids forcing all old wishlist behavior into Contact ownership. Explicit operation records and ownership checks make retries and migration repeatable without merging people by name.
