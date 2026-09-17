# Decision record

## Context

Scope feature 7 completes a platform layer in an existing gift store. The repository has public catalog pages, Google and email authentication, important date forms, occasion wishlists, and an email reminder worker. The intended journey instead shows value before signup and treats saved people, dates, and consent as separate concepts.

This spec is an enhancement, with an umbrella structure because experience, data migration, and identity/import services must agree. It follows the scope's Tracer Bullet approach and Beta verification tier. It does not redesign payments, invent a new visual identity, or replace the application stack.

Product precedence is Experience Design, User Journey & Build Specification, Business Case, then Brand Story. The source guide records that order. Repository conventions govern implementation boundaries; code documents compatibility requirements and migration gaps, not alternative product requirements. Explicit decisions confirmed by the user during this architecture session refine or supersede ambiguous details, as recorded separately below.

Contact privacy and deletion are product requirements, not a claim that this spec establishes legal compliance. No pooled funds, new financial terms, or retention periods for regulated commerce are designed here.

## Options considered

| Option | Benefit | Cost and reason |
| --- | --- | --- |
| Fix only the current date form | Small immediate UI change | Leaves auth gating, no independent Contacts, destructive recurrence, and implicit scheduling intact. It cannot meet the confirmed contract |
| Extend existing domains with compatible migration | Reuses catalog, auth, forms, and ownership conventions; preserves IDs/references through mappings | Requires temporary adapters, evidence review, and coordinated worker cutover. Recommended |
| Replace date/auth storage directly | Cleaner initial implementation with fewer compatibility paths | Risks existing wishlists, accounts, worker references, and unrecoverable original dates. Rejected |

## Rationale

Extending existing domains gives the shortest path to a real first date journey while preserving independent receiver wishlist behavior. Keeping canonical facts apart from effective dates addresses the observed recurrence loss directly. Separating consent, preferences, capability, and actual outcomes prevents a new UI from promising unsupported delivery.

Sanity curation is sufficient for initial recommendations and already supplies real catalog content. No AI ranker, calendar vendor, Google Contacts integration, or new auth platform is needed. SMS selection remains explicitly deferred to implementation by the user, without weakening required phone verification or stable account ownership.

## Source requirements

| Source | Requirements used |
| --- | --- |
| Experience Design | Value before setup; name/relationship/date; three ideas; accessible wishlist priority; relationship and feeling curation; three message cap; user channel choice; mobile/Android and poor connectivity; cultural taxonomy and condolence behavior |
| User Journey & Build Specification | Six cold landing ideas; phone OTP and Google; Contact distinct from User; explicit import consent; regional/timezone foundation; real catalog/manual external data; guest boundaries; instrumentation and staged build |
| Business Case | Occasion coordination is the core interaction; reuse the commerce engine; evidence rather than invented demand; initial scope discipline |
| Brand Story | Warm, specific memory and thoughtfulness framing; do not turn grief or missed dates into pressure |

These are source summaries, not claims that the source documents specify the decisions in the next section.

## Confirmed architecture session decisions

| ID | Decision confirmed by the user |
| --- | --- |
| D-1 | `/dates` is public discovery. Authenticate at save/reminder intent, with no user owned persistent person/event/reminder record before authentication |
| D-2 | Birthday is the visible default through When is their birthday? and Different occasion. Store the actual type explicitly and keep the normal path to three inputs |
| D-3 | Draft lifetime is 24 hours with minimal data, validation, graceful expiry, automatic restoration, and clearing on save/discard/expiry |
| D-4 | A corresponding active Save date auth intent may complete automatically. A rediscovered abandoned draft restores review, not automatic persistence |
| D-5 | Contact is independent from User; nullable verified linkage attaches later without replacing it. No name matching or implied private/link access |
| D-6 | Reuse explicitly selected Contacts and preserve person attributes. Same names may be different people. Detect event duplicates without silent merge; offer archived reactivation |
| D-7 | Import is after auth and successful manual first save. Device selected contacts preferred, CSV compatibility source, no Google Contacts and no vCard initially |
| D-8 | Revised import rule: selected reviewed Contacts may be persisted without relationship or date. Optional imported date candidates need separate confirmation before creating Occasions. This supersedes the earlier conversation's requirement to complete those fields before importing a person |
| D-9 | CSV validates file/rows/fields on server, reports individual errors, supports safe partial import, and never invents personal data or account links |
| D-10 | Birthdays require day/month only; birth year may be unknown. Canonical February 29 is retained, with February 28 as the non leap year effective occurrence. All offsets use the year's effective date |
| D-11 | Explicit occasion aware recurrence is separate from type. Recurring events calculate occurrences without duplicate annual records. One time events remain history; custom recurrence is chosen explicitly |
| D-12 | Givtme manages movable occurrence dates by year and region through controlled configuration; no implicit religious calendar engine/provider. Nigeria is launch default, future regional variation remains possible |
| D-13 | Owner IANA timezone and configured region govern reminder resolution; Contact location does not. Changes affect future unsent schedules. Uncertain managed dates do not trigger speculative reminders |
| D-14 | Saving establishes eligibility, not channel consent. First save offers minimal setup; dates survive refusal. Defaults and occasion overrides are distinguishable; global opt outs prevail |
| D-15 | Global controls belong in Account; occasion controls in Dates; dashboard shows status rather than becoming global settings. First enablement sets defaults for later occasions |
| D-16 | Fallback may use only eligible consented channels permitted for the reminder stage. No eligible channel leaves a saved occasion and truthful in app state. Delivery outcomes distinguish sent/failed/skipped/fallback |
| D-17 | Migration preserves proven legacy email consent and explicit opt outs with provenance; unknown consent is disabled. New channels are never inferred from old data |
| D-18 | Existing users can add verified phone/Google methods to one stable account. Conflicts do not merge accounts; removal preserves data and cannot remove the last usable method |
| D-19 | No SMS provider is currently configured, confirmed by the user. Define a vendor independent provider boundary; select infrastructure during implementation |
| D-20 | Suggestions use real Sanity/Museum context and authorized wishlist priority, then relationship plus occasion, relationship, occasion, broader suitable curation. No AI engine required; distinguish fallback internally; empty results do not block save |
| D-21 | External items retain original URLs, metadata/currency context and distinct purchase flow. Claim intent is not proof of purchase; stale metadata does not delete items |
| D-22 | Deleting a Contact removes the owner's dependent personal data/reminders without altering linked users or independent commerce/wishlists. Deleting one Occasion preserves Contact |
| D-23 | Idempotent migration preserves recoverable original facts and reference mappings; uncertain advanced dates are not accepted as original birthdays. No invented year/relationship or consolidation by name |
| D-24 | Legacy wishlist occasions retain behavior and IDs/mappings, with nullable Contact association unless reliably established or explicitly chosen |
| D-25 | References use repository relative paths and state contributions. Source requirements and session decisions remain distinct. Architecture inventories assets but does not generate decorative assets or final styling |
| D-26 | Revised Account information architecture: `/account` is a hub with `/account/profile`, `/account/orders`, `/account/notifications`, and `/account/security`. Sign out remains an action. Delete Account and any delete account route/destructive account section are absent from this release's UI. Preserve profile, order, and order detail compatibility. This supersedes the draft's instruction to retain order history as the primary Account page |
| D-27 | Apply author review R-1 through R-8 to operative contracts; R-1 through R-4 block personal data rollout. Three/six suggestions are requested targets after fallback, never guaranteed counts that justify unsuitable or unavailable products. |

## Architect recommendations awaiting final artifact review

The approved logical model is retained. R-1 through R-8 below are authorized corrections now applied to the operative contracts; R-1 through R-4 are blocking prerequisites. Physical field/table names, endpoint paths, numerical CSV/OTP/rate limits and active continuation timeout, and relationship keys remain engineering defaults for final artifact review. The temporary server journey state replaces the earlier single payload cookie proposal to satisfy R-4. They are not attributed to a source document or represented as separately confirmed user answers. They can be adjusted during final review without reopening the settled journey.

## Repository inspection evidence

| Observed implementation | Implication |
| --- | --- |
| `proxy.ts` protects `/dates`; `app/(dashboard)/layout.tsx` requires auth and ensures an evergreen wishlist | Public Dates needs a route shell outside that layout and a precise proxy change, not just removing a button guard |
| `ImportantDateForm` uses name, type, full date, recurrence, and wishlist link; saving closes it with a toast | Add relationship and year optional date input; simplify first entry and provide an immediate ideas/continuation state |
| `important_dates` embeds `person_name` and no Contact relation | Backfill needs independent Contacts and source keyed mappings |
| Recurrence code writes the next date into `important_dates.date` and documents loss of February 29 | Derived values cannot be treated as original birthdays; provenance/correction are migration requirements |
| Occasion creation transaction also creates a wishlist | Personal date save must not call it blindly; preserve distinct existing receiver behavior |
| Shared wishlist handling recognizes legacy friends/family access and uses privileged projections | Reuse only behind a verified authorization projection; linked Contact alone must not authorize discovery |
| Reminder constants are 14/3 days and email only; save invokes scheduling | Old behavior conflicts with product ladder and confirmed consent policy |
| Owner unsubscribe deletes pending reminders rather than persisting a preference; invitee path records explicit opt out | Missing rows are not sufficient consent evidence. Preserve demonstrable evidence and treat unknown owner consent as disabled |
| Current OTP page verifies email for password reset; Google uses the existing auth provider | Phone OTP is new work and must not accidentally change reset semantics |
| `/account` currently shows orders; nested profile and order routes already exist | Replace the root page's primary order content with hub navigation under D-26. Reuse the nested order list/detail screens and profile editing rather than rebuilding them |
| `ProfileForm` currently exposes sign out and mounts `DeleteAccountDialog` | Retain sign out as an action; remove the Delete Account affordance/dialog from the release UI during implementation. No application change is made by this spec revision |
| Sanity products/collections and Museum components already exist | Extend editorial context and reuse products rather than introducing a separate catalog |
| UI registry documents auth shells, OTP controls, sheets, cards, and toast patterns | Reuse primitives and one responsive component per concept; final visual assets remain a separate design task |

This is source inspection, not a deployed schema audit, live provider check, or browser verification. Git fetch during preflight could not update `.git/FETCH_HEAD` under the workspace permissions, so remote freshness was not established. Existing uncommitted user changes were preserved. No application tests were run to certify this architecture document.

Technical capability checks during discovery informed the provider/import boundaries. They are not product authorities and no external reference links are included here, per the user's reference policy. Current provider behavior still requires a target project integration check before activation.

## Author review resolutions after Account revision

The requested independent model review could not run because that model reached its usage limit. The findings below are the spec author's review, not independent certification. The Account revision in D-26 has been applied across requirements, child contracts, build plan, and verification. The user subsequently authorized R-1 through R-7 and added R-8. All eight resolutions are now applied across the operative child contracts, acceptance criteria, build ordering, and verification; R-1 through R-4 are blocking architecture corrections, not implementation TODOs. The table retains the original gap descriptions as review history, not current contract requirements. No application code was modified.

Confirmed session decisions remain settled. These findings concern missing enforcement or contradictory implementation details in proposed engineering choices, not a request to change the approved product behavior.

| ID / priority | Concrete gap and evidence | Failure scenario | Applied spec resolution |
| --- | --- | --- | --- |
| R-1 / High | The proposed shared `occasions` table and slice ordering lack an explicit prerequisite to isolate all legacy consumers before the first personal date write. `index.md` slice 1 introduces persistence while slice 2 inventories compatibility; `0002-data-and-migration.md` refers generally to adapters. `lib/occasion/server.ts` lists all owner occasions, and `app/api/occasions/archive/route.ts` archives all active rows by legacy date without a purpose filter | New personal dates appear in receiver wishlist management, or an annual personal occasion with a retained past legacy date is archived by the receiver worker | Make live schema inventory, purpose filters, detail route guards, and worker isolation prerequisites of slice 1. Add a regression proving a personal annual occasion survives the legacy archive pass and is absent from receiver wishlist screens |
| R-2 / High | Contact deletion removes target records while migration retains source rows/mappings and allows backfill replay. No deleted mapping state, source retirement rule, or behavior for receipt foreign keys is defined in `0002-data-and-migration.md` | A restrictive mapping reference blocks deletion; cascading the mapping allows a later backfill to recreate the deleted person/event; preserved provenance retains deleted personal facts | Define a durable deletion marker keyed by legacy source ID, clear unnecessary personal snapshot fields, and make backfill skip retired sources. Define receipt/mapping foreign key behavior and test delete then replay and delete concurrent with backfill |
| R-3 / High | New private fields are proposed on `users`, but the generic owner policy guidance does not address the existing counterparty readable profile policy. `gifvtme_migration_008_profile_management.sql` explicitly avoids SELECT grants on phone for this reason. The contract also lacks a field privilege matrix for server managed linkage/consent evidence and completion markers | Extending ordinary profile SELECT grants exposes timezone/region/onboarding information to gift counterparties, or broad owner UPDATE grants let a client forge verified linkage/provenance | Specify private owner projections or a separate owner only settings table. Enumerate publicly readable profile fields and restrict direct writes to server managed fields, operation receipts, and evidence. Test direct Data API calls as owner, unrelated user, and permitted profile counterparty |
| R-4 / High | Draft continuation requires a corresponding auth transaction and retry with the same save key, but does not name the persistent operation ID, consumption record, or account binding source. The proposed single browser cookie also conflicts with UX-1's promise not to overwrite another open draft | Refresh after a lost save response generates a new operation ID and creates a second Contact; overlapping tabs overwrite draft/intent state; a continuation can be applied to the wrong draft or account | Put an immutable save operation ID and draft revision in the authenticated continuation, bind the verified callback result to the authenticated User, and atomically consume it with the result record. Use authoritative temporary server drafts with per-tab handles and revision conflict checks. Add reload, two tab, replay, and account switch tests |
| R-5 / Medium | The draft excludes share tokens and only keeps suggestion IDs/session display data, but the experience promises preserved context through auth and the ranker requires actual link/invite permission (`0003-services-and-identity.md`, draft and recommendation sections) | After returning from authentication to a link only wishlist suggestion, no retained capability source authorizes the original item. Restoring by ID would bypass access, while dropping the item loses the promised context | Define a minimal protected temporary capability reference, with expiry, binding, and revocation recheck, or an explicit secure return to the original authorized shared context. Do not treat `linked_user_id` or selected item IDs as the capability |
| R-6 / Medium | CSV preview is not retained, but commit submits an edited selected subset plus a signed preview digest. The contract does not define how that subset is verifiable or how edited failed rows receive fresh integrity evidence while successful row receipts remain stable | An implementation either rejects ordinary preview edits/subsets or weakens digest checking to allow them; retries after partial success may reuse keys against changed payloads inconsistently | Define per row signed preview evidence bound to owner, batch, row ID, normalized payload digest, and expiry. Repreview edited rows; committed row IDs remain immutable, and changed payloads return conflict. Cover selected subsets and correction after partial commit in verification |
| R-7 / Medium | `users.timezone` is nullable, but occurrence resolution requires the owner's IANA timezone. No explicit unresolved timezone policy is defined for first save, migrated users, or unsupported device detection | The builder silently substitutes the server timezone, or makes timezone setup a hidden prerequisite before showing ideas | Keep the date save and ideas available; during reminder setup propose the detected valid IANA zone for visible confirmation. If none is available, require a choice before external reminder activation and report timing as unresolved. Name the clock/zone source for public date previews separately |
| R-8 / Medium | AC-1/AC-2 previously used absolute three/six wording despite approved sparse/empty behavior | A builder pads results with unsuitable or unavailable products to satisfy an absolute count | Treat three/six as requested targets after fallback in requirements, experience, recommendation response and verification; preserve saving/exploration with zero valid results |

### Resolution coverage

| Resolution | Operative contract | Acceptance | Build gate/slice | Verification scenario |
| --- | --- | --- | --- | --- |
| R-1 | `0002-data-and-migration.md`: prerequisite gate and migration sequence | AC-15 | 0 before 1/2 | R-1 Blocking first-write gate |
| R-2 | `0002-data-and-migration.md`: durable deletion and replay | AC-15, AC-16 | 0, 2 | R-2 Durable deletion replay |
| R-3 | `0002-data-and-migration.md`: private projections and privileges | AC-5, AC-8, AC-15 | 0 before sensitive values | R-3 Private projections and privileges |
| R-4 | `0003-services-and-identity.md`: draft and save continuation; data operation records | AC-3, AC-4 | 0 proof, 1 activation | R-4 Bound operation and tabs |
| R-5 | `0003-services-and-identity.md`: shared capability restoration; UX-4/7 | AC-3, AC-5, AC-12 | 1, 4 | R-5 Shared capability across auth |
| R-6 | `0003-services-and-identity.md`: device and CSV import; UX-15/16 | AC-11 | 5 | R-6 Row integrity and partial retry |
| R-7 | `0002-data-and-migration.md`: unresolved timezone; UX-9/17 | AC-8, AC-9 | 1, 3 | R-7 Unresolved timezone |
| R-8 | `0001-experience.md`: UX-1/4; recommendation service | AC-1, AC-2, AC-12 | 1, 4 | R-8 Truthful requested counts |

Phone vendor selection, actual provider identity behavior, feature 4 stage timing/fallback, and feature 3 authorization remain explicit activation gates rather than newly discovered contradictions. Proposed numerical OTP/CSV limits remain engineering defaults for review, not source product requirements. The authorized review resolutions are session architecture decisions, not claims attributed to the governing documents.

## References

Paths below are relative to the repository root. Links resolve from this directory. Order preserves product precedence.

| Repository path | Contribution |
| --- | --- |
| [docs/product/02-experience-design.md](../../product/02-experience-design.md) | Primary authority for setup sequence, cultural occasions, feelings, wishlist priority, reminder cap/channel choice, condolence, and mobile behavior |
| [docs/product/03-user-journey-and-build-specification.md](../../product/03-user-journey-and-build-specification.md) | Journeys, six cold ideas, model intent, phone/Google authentication, import consent, first date flow, and build boundaries |
| [docs/product/01-business-case-and-financial-model.md](../../product/01-business-case-and-financial-model.md) | Occasion coordination and reuse of commerce; modelled demand is not factual product evidence |
| [docs/product/04-the-story.md](../../product/04-the-story.md) | Brand narrative and human purpose behind memory and gifting copy |
| [docs/product/README.md](../../product/README.md) | Explicit precedence and brownfield migration rule |
| [AGENTS.md](../../../AGENTS.md) | External/catalog separation, Naira formatting, central GROQ location, current product authority, and unresolved pricing boundary |
| [app/AGENTS.md](../../../app/AGENTS.md) | Route placement, authenticated dashboard behavior, server components, and provider shells |
| [app/api/AGENTS.md](../../../app/api/AGENTS.md) | Handler auth, validation, ownership errors, and colocated API tests |
| [components/AGENTS.md](../../../components/AGENTS.md) | Reusable primitives, responsive components, and provider placement |
| [lib/AGENTS.md](../../../lib/AGENTS.md) | Domain service structure, result validation, service privilege boundaries, and tests |
| [sanity/AGENTS.md](../../../sanity/AGENTS.md) | Content versus transaction ownership, schema registration, queries/types/adapters |
| [docs/scope/scope.md](../../scope/scope.md) | Feature 7, Tracer Bullet approach, Beta tier, adjacent feature responsibilities |
| [ui-registry.md](../../../ui-registry.md) | Existing UI patterns used for reuse decisions |
| [proxy.ts](../../../proxy.ts) and [app/(dashboard)/layout.tsx](../../../app/(dashboard)/layout.tsx) | Current authentication barriers and evergreen wishlist side effect |
| [app/(dashboard)/dates/page.tsx](../../../app/(dashboard)/dates/page.tsx), [components/reminders/ImportantDateForm.tsx](../../../components/reminders/ImportantDateForm.tsx), [components/reminders/ImportantDatesClient.tsx](../../../components/reminders/ImportantDatesClient.tsx) | Current Dates structure, input fields, and save/empty states |
| [lib/important-dates/server.ts](../../../lib/important-dates/server.ts) and [lib/important-dates/validation.ts](../../../lib/important-dates/validation.ts) | Existing persistence, linked list resolution, scheduling side effects, and destructive recurrence |
| [gifvtme_migration_015_reminders.sql](../../../gifvtme_migration_015_reminders.sql) | Important date schema, owner policies, reminder links, incomplete historical schema evidence |
| [gifvtme_migration_005_occasion_wishlist.sql](../../../gifvtme_migration_005_occasion_wishlist.sql) and [lib/occasion/types.ts](../../../lib/occasion/types.ts) | Existing wishlist occasion identity and transaction compatibility |
| [lib/occasion/server.ts](../../../lib/occasion/server.ts) and [app/api/occasions/archive/route.ts](../../../app/api/occasions/archive/route.ts) | Author review evidence for legacy consumers requiring purpose isolation before personal date writes |
| [gifvtme_migration_008_profile_management.sql](../../../gifvtme_migration_008_profile_management.sql) | Author review evidence that existing profile read policy admits counterparties and new private fields need explicit column/projection protection |
| [lib/occasion/constants.ts](../../../lib/occasion/constants.ts) | Current six type vocabulary requiring expansion and aliases |
| [lib/reminders/constants.ts](../../../lib/reminders/constants.ts), [lib/reminders/scheduleImportantDateReminders.ts](../../../lib/reminders/scheduleImportantDateReminders.ts), [app/api/reminders/unsubscribe/route.ts](../../../app/api/reminders/unsubscribe/route.ts) | Legacy timing, automatic scheduling, and consent evidence limitations |
| [app/(auth)/callback/route.ts](../../../app/(auth)/callback/route.ts), [components/auth/GoogleOAuthButton.tsx](../../../components/auth/GoogleOAuthButton.tsx), [app/(auth)/verify-otp/VerifyOtpScreen.tsx](../../../app/(auth)/verify-otp/VerifyOtpScreen.tsx) | Existing OAuth continuation and email reset OTP behavior |
| [app/account/page.tsx](../../../app/account/page.tsx), [app/account/orders/page.tsx](../../../app/account/orders/page.tsx), [app/account/profile/page.tsx](../../../app/account/profile/page.tsx), and [app/account/profile/ProfileForm.tsx](../../../app/account/profile/ProfileForm.tsx) | Current account navigation, reusable nested orders/profile behavior, sign out action, and Delete Account UI to remove under D-26 |
| [app/account/profile/actions.ts](../../../app/account/profile/actions.ts) | Existing account deletion implementation is evidence of current behavior, not authorization to expose deletion in this release |
| [app/page.tsx](../../../app/page.tsx), [app/shop/page.tsx](../../../app/shop/page.tsx), [components/occasion/MuseumOccasionGrid.tsx](../../../components/occasion/MuseumOccasionGrid.tsx) | Public discovery and catalog UI reuse |
| [sanity/schemaTypes/product.ts](../../../sanity/schemaTypes/product.ts), [sanity/schemaTypes/collection.ts](../../../sanity/schemaTypes/collection.ts), [lib/sanity/queries.ts](../../../lib/sanity/queries.ts) | Real candidate data, variants, editorial collections, and central query projections |
| [lib/wishlist/shared.ts](../../../lib/wishlist/shared.ts) | Existing shared access and privacy compatibility requirements |
| [lib/env.ts](../../../lib/env.ts) and [package.json](../../../package.json) | Existing provider configuration boundary and installed stack |
| [.agents/skills/supabase/SKILL.md](../../../.agents/skills/supabase/SKILL.md) and [.agents/skills/supabase-postgres-best-practices/SKILL.md](../../../.agents/skills/supabase-postgres-best-practices/SKILL.md) | Auth/privilege boundaries, ownership policies, safe schema and index design |

The externally installed Sanity skill is named in the implementation guidance but is not given a fabricated repository path. Source decisions above are traceable to the repository files actually inspected.
