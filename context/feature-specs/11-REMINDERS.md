# Feature: Reminders (Flow 1, Flow 2 & Delivery)

> **Status note (2026-07-31):** Flow 2 (invitee opt-in) and the owner-reminder scheduling/cron scaffolding were already shipped under migration 006 (see `08-SHARED-WISHLIST-VIEW.md`). This pass audited the rest of this spec against shipped code and built the two genuine gaps: **Flow 1 (important dates)** was completely unbuilt — the `important_dates` table existed live with zero application code reading or writing it, and `/dashboard/dates` was a static empty-state stub — and **real reminder delivery**, since `/api/reminders` previously only queued due rows and never actually sent anything. Per [[feedback-spec-vs-architecture-precedence]], several of this spec's original proposals were adjusted to match this repo's established conventions rather than built literally — see the divergence notes inline below and in each section. This file documents shipped reality, not the original aspirational design.

## Overview
Two independent reminder flows sharing the same `reminders` table and delivery infrastructure. **Flow 1:** The receiver tracks other people's occasions and gets reminded before they arrive (e.g. "Mum's birthday in 3 days"). **Flow 2:** Invited givers opt in to be reminded about the receiver's occasion (e.g. "Sarah's birthday is in 14 days"). Both flows schedule two reminders per occasion: 14 days before and 3 days before. Delivery is via email (Resend) — push notification delivery remains deferred (the `channel` column and scheduling already account for it, but the cron only ever dispatches `email`). A cron job (`POST /api/reminders`) processes the `reminders` table and sends due reminders.

There is also a third, pre-existing owner-reminder source not originally described in this spec: reminders for an occasion the user created themselves (via `/my-occasions/new`), keyed by `reminders.occasion_id` rather than `important_date_id`. It shares the same `reminder_type = 'occasion_owner'` and delivery path as Flow 1 — see "Occasion-owner reminders" below.

---

## Goals
- Help users never miss buying a gift for someone they care about (Flow 1).
- Help givers remember an upcoming occasion they've been invited to (Flow 2).
- Deliver reminders reliably — failures retry, not lost.
- Build a durable queue that doesn't depend on a long-running process.

---

## User Stories

**Flow 1 (receiver tracks others):**
- As a receiver, I can save my mum's birthday with her name, the occasion type, and the date.
- As a receiver, my saved dates recur automatically each year — I don't need to re-enter them annually.
- As a receiver, I get an email 14 days and 3 days before each saved occasion.
- As a receiver, I can link a saved date to the person's Gifvtme wishlist if they have one.
- As a receiver, I can edit or delete a saved date.

**Flow 2 (giver opts in):**
- As an invited giver, I can opt in to receive a reminder before the receiver's occasion.
- As a giver, if I've opted in, I get an email 14 days and 3 days before the occasion.
- As a giver, I can unsubscribe from reminders by clicking a link in the email.

**Delivery:**
- As a user, reminder emails arrive within a few minutes of their scheduled time.
- As a user, a failed delivery is retried automatically — I'm not silently skipped.

---

## Functional Requirements

### Flow 1 — Important Dates
1. Route: `/dashboard/dates` (`ImportantDatesClient` renders the whole page — header/CTA, list, add/edit form, delete confirmation).
2. CRUD on `important_dates` via `GET/POST /api/important-dates` and `PATCH/DELETE /api/important-dates/[id]`: `person_name`, `occasion_type`, `date`, optional `linked_wishlist_id`.
   - **Divergence:** `occasion_type` reuses this repo's existing 6-value `OCCASION_TYPES` enum (`lib/occasion/constants.ts` — adds `baby_shower`, drops nothing) rather than this spec's original narrower 5-value list, so Flow 1 shares the same occasion-type vocabulary, icons, and labels as user-created occasions instead of introducing a second one.
   - **Divergence:** `date` validation reuses `occasionDateSchema` (must be today or later, at most 5 years out) rather than accepting an arbitrary date — this field represents the *next occurrence*, matching how `occasions.occasion_date` already works, not a birth year.
   - **Divergence:** the spec's `linked_wishlist_url` (a raw stored URL) is instead `linked_wishlist_id`, a nullable FK to `wishlists`. The API still accepts a pasted `linked_wishlist_url` in the request body, but resolves it server-side via the existing `gifvtme_get_shared_wishlist` RPC (the same resolver `/w/[id]` itself uses) and stores the resulting wishlist id — or returns 400 if the link doesn't resolve. Storing an FK rather than a raw URL means the reminder email's "view their wishlist" link always reflects the wishlist's current sharing state rather than a possibly-stale pasted string.
3. On create: `createImportantDate` calls `scheduleImportantDateReminders(importantDateId, date)` → inserts 2 `reminders` rows (14-day and 3-day before `date`) with `reminder_type='occasion_owner'`, `important_date_id` set, `channel='email'`, `sent=false`, `days_before` set to `14`/`3`. Only scheduled when the date is in the future (a date within 3 days still gets both rows — see Edge Cases).
4. Recurring dates: `important_dates.is_recurring` boolean (default true; the add/edit form auto-defaults it on for `birthday`/`anniversary` and off otherwise, matching the spec's original intent, but the user can override it either way). After the 3-day reminder fires for a recurring date, the cron auto-advances `important_dates.date` to the next year's occurrence and reschedules reminders (`advanceRecurringImportantDate`).
5. Feb 29 birthdays: if the date is `month === 2 && day === 29`, advancement uses Feb 28 in a non-leap target year (JS `Date`'s own month-rollover on `setFullYear` is how this is detected). **Known limitation, not fully solved:** because the substituted Feb 28 is what gets persisted (a Postgres `date` column can't hold an invalid Feb 29), the original day is lost — a Feb-29 date will keep advancing as Feb 28 in every subsequent year rather than "waiting" to land back on Feb 29 in the next leap year, as this spec's original edge case #4 wanted. Solving that properly would need a separate original-day column; out of scope for this pass.

### Flow 2 — Invite Opt-In
Shipped under migration 006, unchanged by this pass except for two closed gaps (below). Route/method/naming already diverges from this spec's original proposal — see `08-SHARED-WISHLIST-VIEW.md`'s status note for that reconciliation. Summary of what's live:
1. Giver toggles opt-in via `POST /api/wishlists/[id]/invites/[inviteId]/opt-in` (existing invite) or `POST /api/wishlists/[id]/reminders/opt-in` (public wishlist, creates/reuses an invite row) — not the single `PATCH /api/invites/[inviteId]/reminder-opt-in` this spec originally proposed.
2. On opt-in: `scheduleInviteeReminders(inviteId, occasionDate)` deletes any existing unsent invitee reminders for that invite, then inserts 2 new rows (`reminder_type='invitee'`, `invite_id` set, `channel='email'`, `days_before` set) when the occasion date is in the future.
3. **Closed this pass:** when an occasion's date changes (`PATCH /api/occasions/[id]`), invitee reminders for every opted-in invite on that occasion now reschedule too (`rescheduleInviteeRemindersForOccasion`) — previously only the owner's own reminders rescheduled.
4. **Closed this pass:** the unsubscribe link in reminder emails now actually works (`GET /api/reminders/unsubscribe`) — sets `reminder_opted_in=false` and deletes unsent invitee reminders for that invite.
5. **Still a gap, not closed:** there's no in-app opt-out toggle (only the email unsubscribe link) and no explicit reminder cleanup when an invite is deleted beyond whatever FK behavior the base schema defines — neither was in this pass's approved scope.

### Occasion-owner reminders (pre-existing, not originally in this spec)
`scheduleOccasionReminders`/`rescheduleOccasionReminders` (`lib/occasion/server.ts`, `lib/reminders/scheduleOccasionReminders.ts`) schedule the same 14-day/3-day owner reminders for occasions the user creates via `/my-occasions/new`, keyed by `reminders.occasion_id`. These reminders now send real email too (this pass's delivery work applies to both `important_date_id` and `occasion_id` owner sources — see `buildReminderEmail`), but they don't recur or advance (an occasion is expected to archive after its date passes, per the existing daily archive cron, not repeat annually like a Flow 1 important date).

### Delivery (cron)
1. Cron route: `POST /api/reminders` — runs every 15 minutes via Vercel Cron.
2. Protected by `Authorization: Bearer ${CRON_SECRET}`.
3. Query: due `email`-channel reminders — `sent=false AND permanently_failed=false AND scheduled_at <= NOW()`, oldest first, `LIMIT 50`. `push`-channel due reminders are counted (`deferred` in the response) but never dispatched — push delivery itself is out of scope.
4. For each due reminder:
   a. Resolve the recipient's email via `supabase.auth.admin.getUserById(reminder.user_id)` (cached per run so reminders sharing a user only look it up once).
   b. Build subject/body via `buildReminderEmail`, branching on `reminder_type` and which of `important_date_id`/`occasion_id`/`invite_id` is set. Returns `null` if the parent row was deleted while queued — the reminder is deleted outright rather than retried (see Edge Cases).
   c. Send via `sendReminderEmail` (Resend).
   d. On success: `UPDATE reminders SET sent=true, sent_at=NOW()`, then (owner reminders tied to a recurring `important_date_id`, `days_before=3` only) advance and reschedule.
   e. On failure: increment `retry_count`; set `permanently_failed=true` once it reaches 5.

---

## Non-Functional Requirements
- Cron runs every 15 minutes — maximum 15-minute delay between scheduled time and delivery.
- A single Resend failure never crashes the whole batch — each reminder is processed in its own try/catch.
- `retry_count` caps at 5 — after 5 failures, `permanently_failed=true` and it stops retrying (prevents infinite retry loops on a dead email address).

---

## UI Requirements

### Route: `/dashboard/dates`

**Page header:** "Important dates" + "Add a date" CTA (a "View wishlists" link is also kept for nav continuity — not in the original spec, low-stakes addition).

**Date list:** cards (`ImportantDateCard`), each showing:
- Occasion type icon + person name
- Date formatted via `formatOccasionDate` (`lib/occasion/date.ts`) + "Recurs annually" note when applicable
- Colored days-to-go pill (same visual pattern as `OccasionCard`'s)
- "Wishlist linked" badge if `linked_wishlist_id` is set
- Inline three-dot menu: Edit, Delete (no shared `DropdownMenu` primitive exists yet, so this follows `OccasionDetailClient`'s own inline-menu pattern rather than a new component)

**Add/Edit form (`ImportantDateForm`):** a `Sheet` (this repo's existing responsive bottom-sheet-on-mobile/dialog-like-on-desktop primitive, already used for every other add/edit flow — not a separate `Dialog` on desktop as this spec originally proposed):
- Person name (text input, required)
- Occasion type (`OccasionTypeSelector` grid, same component occasion creation uses)
- Date (native date input)
- "Recurs annually" toggle (`Switch`, auto-defaults per occasion type until the user touches it)
- Linked wishlist URL (optional text input, resolved server-side)
- Save CTA, plus a Delete action when editing (mirrors `EditItemSheet`'s convention)

**Empty state:** Illustrated calendar icon, "No special dates saved yet." + CTA — unchanged from the original stub's copy.

**Reminder opt-in on shared wishlist / success screen (Flow 2):** unchanged, see `08-SHARED-WISHLIST-VIEW.md`.

---

## Database Changes

**`important_dates` table** — existed live with no migration file backing it; migration 015 is the first to formally own its schema:
```sql
CREATE TABLE IF NOT EXISTS public.important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  occasion_type text NOT NULL DEFAULT 'other',
  date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT true,
  linked_wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
Owner-only RLS (`user_id = auth.uid()`) on all four operations. No soft-archive — deletes are hard deletes, since this is a personal note list with no purchase/order history riding on it (unlike wishlist items or occasions).

**`reminders` table** — migration 015 adds:
```sql
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS days_before integer,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanently_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
```
`occasion_id` (this spec originally proposed `source_occasion_id`) already existed from migration 005 — naming-only divergence, not a gap.

**Migration status:** migration 015 is written but **not yet confirmed applied to Supabase** as of this pass — Flow 1 and real reminder delivery will not work in any deployed environment until it is. See `ROADMAP.md`.

**`vercel.json` cron configuration** (unchanged from the original proposal):
```json
{
  "crons": [
    { "path": "/api/reminders", "schedule": "*/15 * * * *" }
  ]
}
```

---

## API Endpoints

See `architecture/API_ROUTES.md` for the authoritative, current contract of every route below — kept in sync in the same change as the code.

### `GET /api/important-dates` / `POST /api/important-dates`
List or create the current user's important dates.

### `PATCH /api/important-dates/[id]` / `DELETE /api/important-dates/[id]`
Edit or delete a date (hard delete).

### `POST /api/reminders` (cron)
Process due reminders. Response is `{ processed, failed, deferred }`, not this spec's original `{ processed, failed }` — `deferred` reports still-queued `push`-channel rows.

### `GET /api/reminders/unsubscribe`
Unsubscribe from reminders via email link — GET with `token`/`type` query params, returns an HTML confirmation page. Matches the original proposal.

### `POST /api/wishlists/[id]/invites/[inviteId]/opt-in` / `POST /api/wishlists/[id]/reminders/opt-in`
Toggle Flow 2 opt-in — see `08-SHARED-WISHLIST-VIEW.md` for the full reconciliation of why this differs from the originally-proposed single `PATCH /api/invites/[inviteId]/reminder-opt-in`.

---

## Permissions and Authorization
- `important_dates`: strict owner-only RLS (`user_id = auth.uid()`).
- `reminders`: no direct client access — read/written only via `createServiceClient()` in the cron route and via the scheduling helpers running under the authenticated user's own RLS-scoped client.
- Cron route: `CRON_SECRET` bearer token — no user auth.
- Unsubscribe: token-only, no auth required (must work from email clients) — uses the service-role client since there's no session to scope RLS to.

---

## Validation

`lib/important-dates/validation.ts`:
```typescript
export const importantDateSchema = z.object({
  person_name: z.string().trim().min(1).max(100),
  occasion_type: occasionTypeSchema, // reused from lib/occasion/validation.ts
  date: occasionDateSchema,          // reused — future, ≤5 years out
  is_recurring: z.boolean().default(true),
  linked_wishlist_url: z.string().trim().url().or(z.literal("")).optional(),
});
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Resend send fails | Increment `retry_count`, don't mark sent. Retry on next cron run. |
| `retry_count >= 5` | Set `permanently_failed=true`, stop retrying, log for monitoring. |
| Cron secret missing/wrong | 401, don't process anything. |
| Important date not found on edit | 404. |
| `linked_wishlist_url` doesn't resolve to a real wishlist | 400, date is not saved (this spec's original version didn't specify this case since `linked_wishlist_url` was a raw string). |
| Reminder's parent row deleted while queued | Reminder deleted outright, not retried (see Edge Cases). |

---

## Loading and Empty States
- **Dates list loading:** server-rendered on request, no client loading state needed (matches how `/my-occasions` and `/wishlists` already fetch).
- **Empty dates:** illustrated empty state with "Add a date" CTA.
- **No reminder opt-in shown to non-invitees** — component not rendered, not just hidden (unchanged, see `08-SHARED-WISHLIST-VIEW.md`).

---

## Edge Cases

1. **Two reminders for the same date (both 14-day and 3-day)** scheduled in the past because the user added a date for an occasion that's already within 14 days. Only reminders whose computed `scheduled_at` is still in the future are inserted (both scheduling helpers filter this before insert) — so a date added 2 days out only gets a 3-day reminder if `scheduled_at` (today − 3) is still ahead of now, otherwise neither fires. This is a deliberate simplification versus the spec's original "schedule both, let the cron catch up on both" — inserting an already-past `scheduled_at` row serves no purpose since the cron only reads forward from now.

2. **User deletes an important date while a reminder is in the cron's due batch.** `DELETE /api/important-dates/[id]` explicitly deletes that date's unsent reminders before deleting the row itself (not relying solely on whatever `ON DELETE` behavior the base schema's `important_date_id` FK has, since that predates this repo's migration history and isn't verifiable from the code). If a race still leaves an orphaned reminder row, `buildReminderEmail` returns `null` when the join comes back empty and the cron deletes that row instead of retrying it.

3. **Occasion date changes, Flow 2 reminders need rescheduling.** `PATCH /api/occasions/[id]` now calls both `rescheduleOccasionReminders` (owner) and `rescheduleInviteeRemindersForOccasion` (every opted-in invite) when `occasion_date` changes.

4. **Feb 29 birthday in a non-leap year.** Advances to Feb 28 — see the documented limitation in Functional Requirements #5 above; the "advance correctly back to Feb 29 in the next leap year" behavior this spec originally wanted is not fully solved.

5. **User has 50 important dates all with the same occasion date.** The 50-per-run cap means 50 emails is fine in one run; more would spill into the next 15-minute run — acceptable.

6. **The cron runs but Resend is down for an extended period.** All due reminders accumulate `retry_count`; after 5 failures each is marked `permanently_failed`. No alerting is built for this yet (still a real risk, as the original spec noted).

---

## Analytics / Events
- `important_date.created` (occasion_type, is_recurring)
- `important_date.edited` (occasion_type, is_recurring)
- `important_date.deleted`
- `reminder_optin.accepted` / `reminder_optin.declined` — Flow 2, pre-existing naming (this spec originally proposed `reminder.opt_in.toggled`; left as shipped).

No `reminder.sent`/`reminder.failed`/`reminder.permanently_failed`/`reminder.unsubscribed` server-side analytics events were added this pass — the cron already logs equivalent information via `processed`/`failed`/`deferred` in its response and `console.error` on failures; adding a formal analytics event for a cron-only code path wasn't judged worth the extra surface for this pass.

---

## Testing Requirements

### Unit tests (added this pass)
- `lib/important-dates/validation.test.ts` — person_name/date/linked_wishlist_url validation rules.
- `lib/reminders/buildReminderEmail.test.ts` — correct subject/body per reminder source (important date with/without a linked wishlist, occasion-owner, invitee), and the orphaned-parent → `null` case for each source.

### Not added this pass
- No integration tests for the cron's Resend send / retry / permanently-failed paths, or for `advanceRecurringImportantDate`'s DB update — would need Supabase test doubles beyond this session's scope (same gap noted in `10-AFFILIATE-PURCHASE-CONFIRM.md` for a similar reason).

### Manual QA
- Add an important date 15 days from today. Verify two reminder rows exist at correct dates once migration 015 is applied.
- Toggle reminder opt-in on a shared wishlist page. Verify two `reminders` rows created with `invite_id` set.
- Once `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are configured, manually trigger the cron and verify an email arrives and `sent=true`.
- Click the unsubscribe link in a reminder email. Verify opt-in set to false (invitee) or reminders deleted (owner).

---

## Acceptance Criteria
- [x] Creating an important date schedules up to 2 reminders (14-day, 3-day) — fewer if the date is close enough that one window has already passed.
- [x] Editing a date reschedules reminders to the new date.
- [x] The cron job sends due reminder emails via Resend and marks them sent.
- [x] Resend failures increment `retry_count` and are retried on the next cron run.
- [x] After 5 failures, `permanently_failed=true` and the reminder stops being retried.
- [x] Recurring dates are automatically advanced and rescheduled after the 3-day reminder fires (with the documented Feb-29 drift limitation).
- [x] Giver Flow 2 opt-in creates correctly scheduled reminders (pre-existing).
- [x] Unsubscribe link in email correctly removes future reminders / opts out.
- [ ] Migration 015 confirmed applied to the Supabase project — **not yet done as of this pass.**

---

## Future Improvements
- Push notification delivery (requires native app or web push setup) — `channel='push'` rows are already scheduled and simply left queued.
- A proper fix for the Feb-29 recurring-date drift (needs an original-day column or equivalent).
- Custom reminder windows (e.g. 7 days, 1 month — user-configurable).
- "I got a gift!" confirmation in reminder email (one-click purchase tracking).
- SMS reminders via a Nigerian SMS gateway (Termii, Kudisms).
- Alerting when `permanently_failed` count crosses a threshold.
