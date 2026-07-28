# Feature: Reminders (Flow 1, Flow 2 & Delivery)

## Overview
Two independent reminder flows sharing the same `reminders` table and delivery infrastructure. **Flow 1:** The receiver tracks other people's occasions and gets reminded before they arrive (e.g. "Mum's birthday in 3 days"). **Flow 2:** Invited givers opt in to be reminded about the receiver's occasion (e.g. "Sarah's birthday is in 14 days"). Both flows schedule two reminders per occasion: 14 days before and 3 days before. Delivery is via email (Resend) in v1 — push notification delivery is deferred. A cron job processes the `reminders` table and sends due reminders.

---

## Goals
- Help users never miss buying a gift for someone they care about (Flow 1).
- Help givers remember an upcoming occasion they've been invited to (Flow 2).
- Deliver reminders reliably — failures must retry, not be lost.
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
1. Route: `/dashboard/dates`.
2. CRUD on `important_dates`: person name, occasion type, date, optional linked wishlist URL.
3. On create: call `scheduleOwnerReminders(importantDateId, date)` → inserts 2 `reminders` rows (14-day and 3-day before `date`) with `reminder_type='occasion_owner'`, `important_date_id` set, `channel='email'`, `sent=false`.
4. Recurring dates: `important_dates.is_recurring` boolean (default true for birthday/anniversary). After a reminder fires for a recurring date, the system auto-advances `important_dates.date` to the next year's occurrence and reschedules reminders.
5. Feb 29 birthdays: if `date.month === 2 && date.day === 29`, the recurring advancement uses Feb 28 in non-leap years.

### Flow 2 — Invite Opt-In
1. Giver toggles `reminder_opted_in = true` on their `wishlist_invites` row (from the shared wishlist page or the success screen after purchase).
2. On toggle to true: call `scheduleInviteeReminders(inviteId, occasionDate)` → inserts 2 `reminders` rows with `reminder_type='invitee'`, `invite_id` set, `channel='email'`, `sent=false`.
3. On toggle to false (opt-out): delete unsent `reminders` rows where `invite_id` = this invite's id and `sent=false`.
4. When an invite is removed by the receiver: delete all associated unsent `reminders`.
5. When an occasion date changes: delete unsent reminders for all invites of that occasion, reschedule at new date.

### Delivery (cron)
1. Cron route: `POST /api/reminders` — runs every 15 minutes via Vercel Cron.
2. Protected by `Authorization: Bearer ${CRON_SECRET}`.
3. Query: `SELECT * FROM reminders WHERE sent=false AND scheduled_at <= NOW() LIMIT 50`.
4. For each reminder:
   a. Determine reminder type and fetch data needed for the email template.
   b. Send via Resend.
   c. On Resend success: `UPDATE reminders SET sent=true, sent_at=NOW()`.
   d. On Resend failure: increment `retry_count`, do NOT set `sent=true`. Will retry on next cron run.
5. After processing recurring dates: auto-advance and reschedule.

---

## Non-Functional Requirements
- Cron runs every 15 minutes — maximum 15-minute delay between scheduled time and delivery.
- A single Resend failure must not crash the whole batch — catch errors per-reminder, continue processing others.
- `retry_count` should cap at 5 — after 5 failures, set `permanently_failed=true` and stop retrying (prevents infinite retry loops on a dead email address).

---

## UI Requirements

### Route: `/dashboard/dates`

**Page header:** "Important dates" + "Add a date" CTA.

**Date list:** cards, each showing:
- Occasion type icon + person name
- Date formatted as "July 15" (or "July 15, 2025" if not recurring)
- "In X days" countdown chip (same color coding as occasion countdown)
- Linked wishlist badge if `linked_wishlist_url` is set
- Three-dot menu: Edit, Delete

**Add/Edit form** (bottom sheet on mobile, dialog on desktop):
- Person name (text input, required)
- Occasion type (select, same enum as occasion types)
- Date (date picker)
- "Recurs annually" toggle (default on for birthday/anniversary, off for others)
- Linked wishlist URL (optional text input)
- Save CTA

**Empty state:** Illustrated calendar icon, "No dates saved yet. Add your first important date." + CTA.

**Reminder opt-in on shared wishlist / success screen** (Flow 2):
- Already specified in `02-SHARED-WISHLIST-VIEW.md` and `04-AFFILIATE-PURCHASE-CONFIRM.md`.
- Triggers `PATCH /api/invites/[inviteId]/reminder-opt-in`.

---

## Backend Logic

### `scheduleOwnerReminders(importantDateId, date)`
```typescript
function scheduleOwnerReminders(importantDateId: string, date: Date) {
  const fourteenDaysBefore = subDays(date, 14)
  const threeDaysBefore = subDays(date, 3)
  
  const reminders = [
    { important_date_id: importantDateId, reminder_type: 'occasion_owner',
      channel: 'email', scheduled_at: fourteenDaysBefore, days_before: 14 },
    { important_date_id: importantDateId, reminder_type: 'occasion_owner',
      channel: 'email', scheduled_at: threeDaysBefore, days_before: 3 },
  ]
  
  await supabase.from('reminders').insert(reminders)
}
```

### `scheduleInviteeReminders(inviteId, occasionDate)`
Same pattern, `reminder_type='invitee'`, `invite_id` set instead of `important_date_id`.

### Cron job — reminder delivery
```typescript
// /api/reminders/route.ts — POST handler
const due = await supabase
  .from('reminders')
  .select('*, important_dates(*), wishlist_invites(*, wishlists(*, occasions(*), users(*)))')
  .eq('sent', false)
  .eq('permanently_failed', false)
  .lte('scheduled_at', new Date().toISOString())
  .limit(50)

for (const reminder of due.data) {
  try {
    const emailData = buildReminderEmail(reminder) // returns { to, subject, html }
    await resend.emails.send(emailData)
    await supabase.from('reminders').update({ sent: true, sent_at: new Date() }).eq('id', reminder.id)
    
    // Handle recurring date advancement (Flow 1 only, 3-day reminder = last reminder for this year)
    if (reminder.reminder_type === 'occasion_owner' && reminder.days_before === 3 && reminder.important_dates?.is_recurring) {
      await advanceRecurringDate(reminder.important_dates)
    }
  } catch (err) {
    const newRetryCount = (reminder.retry_count || 0) + 1
    await supabase.from('reminders').update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= 5,
    }).eq('id', reminder.id)
  }
}
```

### `advanceRecurringDate(importantDate)`
```typescript
function advanceRecurringDate(importantDate) {
  let nextDate = addYears(new Date(importantDate.date), 1)
  // Feb 29 handling:
  if (getMonth(nextDate) === 1 && getDate(nextDate) === 29 && !isLeapYear(getYear(nextDate))) {
    nextDate = setDate(setMonth(nextDate, 1), 28)
  }
  await supabase.from('important_dates').update({ date: nextDate }).eq('id', importantDate.id)
  await scheduleOwnerReminders(importantDate.id, nextDate)
}
```

### Email templates

**Flow 1 — occasion_owner:**
```
Subject: 🎁 [Person Name]'s [Occasion Type] is in [X] days
Body: Reminder that [Person Name]'s [occasion] is on [date].
      [If linked wishlist] → "View their wishlist: [url]"
      "Browse gift ideas on Gifvtme: [link]"
      Unsubscribe: [link to /api/reminders/unsubscribe?token=...]
```

**Flow 2 — invitee:**
```
Subject: 🎂 [Receiver Name]'s [Occasion] is in [X] days
Body: Just a reminder — [Receiver Name]'s [occasion] is on [date].
      "View their wishlist and buy a gift: [url]"
      Unsubscribe: [link to /api/reminders/unsubscribe?token=...]
```

### Unsubscribe handler
`GET /api/reminders/unsubscribe?token=<invite_id or important_date_id>&type=owner|invitee`
Sets `reminder_opted_in=false` for invitees, or deletes unsent reminders for owners.

---

## Database Changes

**`important_dates` table** (migration 001 — verify all fields exist):
```sql
CREATE TABLE IF NOT EXISTS important_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  occasion_type TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  linked_wishlist_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`reminders` table** — add columns if not in migration 001:
```sql
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS days_before INTEGER; -- 14 or 3
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS permanently_failed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS source_occasion_id UUID REFERENCES occasions(id) ON DELETE CASCADE;
```

**`vercel.json` cron configuration:**
```json
{
  "crons": [
    { "path": "/api/reminders", "schedule": "*/15 * * * *" }
  ]
}
```

---

## API Endpoints

### `GET /api/important-dates`
List all important dates for the current user.
**Auth:** required.
**Response:** `{ dates: ImportantDate[] }`.

### `POST /api/important-dates`
Create a new important date and schedule reminders.
**Auth:** required.
**Body:** `{ person_name, occasion_type, date, is_recurring, linked_wishlist_url? }`
**Response:** `{ date: ImportantDate }`.

### `PATCH /api/important-dates/[id]`
Update a date. If `date` changes: delete unsent reminders, reschedule.
**Auth:** required (owner).
**Response:** `{ date: ImportantDate }`.

### `DELETE /api/important-dates/[id]`
Delete a date and its unsent reminders.
**Auth:** required (owner).
**Response:** `{ deleted: true }`.

### `POST /api/reminders` (cron)
Process due reminders.
**Auth:** `Authorization: Bearer ${CRON_SECRET}`.
**Response:** `{ processed: number, failed: number }`.

### `GET /api/reminders/unsubscribe`
Unsubscribe from reminders via email link.
**Auth:** none (token-based).
**Query params:** `token`, `type`.
**Response:** HTML page: "You've been unsubscribed."

### `PATCH /api/invites/[inviteId]/reminder-opt-in`
Toggle Flow 2 opt-in.
**Auth:** required.
**Body:** `{ opted_in: boolean }`
**Response:** `{ updated: true }`.

---

## Permissions and Authorization
- `important_dates`: strict owner-only RLS (`user_id = auth.uid()`).
- `reminders`: strict owner-only (resolved via the `important_date_id` or `invite_id` join).
- Cron route: `CRON_SECRET` bearer token — no user auth.
- Unsubscribe: token-only, no auth required (must work from email clients).

---

## Validation

```typescript
const importantDateSchema = z.object({
  person_name: z.string().min(1).max(100),
  occasion_type: z.enum(['birthday', 'anniversary', 'graduation', 'wedding', 'other']),
  date: z.string().refine(d => !isNaN(Date.parse(d))),
  is_recurring: z.boolean().default(true),
  linked_wishlist_url: z.string().url().optional().or(z.literal('')),
})
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Resend send fails | Increment `retry_count`, don't mark sent. Retry on next cron run. |
| `retry_count >= 5` | Set `permanently_failed=true`, stop retrying, log for monitoring. |
| Cron secret missing/wrong | 401, don't process anything. |
| Important date not found on edit | 404. |
| Scheduling fails after date save | Log error, return 500, but do NOT save the date without reminders (transaction rollback). |

---

## Loading and Empty States
- **Dates list loading:** skeleton cards.
- **Empty dates:** illustrated empty state with "Add a date" CTA.
- **No reminder opt-in shown to non-invitees** — component not rendered, not just hidden.

---

## Edge Cases

1. **Two reminders for the same date (both 14-day and 3-day)** scheduled in the past because the user added a date for an occasion that's already within 14 days. The cron will fire both on the next run (or the next few runs within the batch). This is correct — both reminders should be sent.

2. **User deletes an important date while a reminder is in the `due` queue** (scheduled for today). The delete cascades via `ON DELETE CASCADE` on `reminders.important_date_id`. The cron picks up the reminder, can't find its parent `important_dates` row — handle this gracefully (skip, don't throw).

3. **Occasion date changes, Flow 2 reminders need rescheduling.** The `PATCH /api/occasions/[id]` handler must: delete unsent `reminders` with `invite_id` in (all invites for this occasion's wishlist), then re-run `scheduleInviteeReminders` for each opted-in invite with the new date.

4. **Feb 29 birthday in a non-leap year.** Advance to Feb 28. Store the original date (Feb 29) in the DB — only the reminder calculation uses Feb 28. The next leap year, advance correctly back to Feb 29.

5. **User has 50 important dates all with the same occasion date.** The 14-day reminder cron will process up to 50 emails in one run. With the 50-item limit per cron run, 50 emails is fine; 200 dates would require multiple cron runs (acceptable — within 15 minutes all would be sent).

6. **The cron runs but Resend is down for an extended period.** All reminders accumulate `retry_count` increments. After 5 failures, they're marked `permanently_failed`. **This is a real risk for important reminders — consider alerting when `permanently_failed` count crosses a threshold.**

---

## Analytics / Events
- `important_date.created` (occasion_type, is_recurring)
- `important_date.deleted`
- `reminder.sent` (type: occasion_owner | invitee, days_before: 14 | 3)
- `reminder.failed` (type, retry_count)
- `reminder.permanently_failed` (type)
- `reminder.opt_in.toggled` (opted_in: bool)
- `reminder.unsubscribed` (type)

---

## Testing Requirements

### Unit tests
- `scheduleOwnerReminders`: correct `scheduled_at` values for both windows.
- `advanceRecurringDate`: correct next-year advancement, Feb 29 → Feb 28 in non-leap years.
- `buildReminderEmail`: correct subject/body for each reminder type and days_before value.

### Integration tests
- Create important date → 2 reminder rows created at correct scheduled times.
- Edit date → old unsent reminders deleted, new ones created.
- Delete date → cascaded reminders deleted.
- Cron: due reminder → Resend called, `sent=true` set.
- Cron: Resend failure → `retry_count` incremented, `sent` remains false.
- After 5 failures → `permanently_failed=true`.
- Recurring date advancement after 3-day reminder fires.

### Manual QA
- Add an important date 15 days from today. Verify two reminder rows exist at correct dates. Wait for (or manually trigger) the cron at the 14-day mark. Verify email received and `sent=true`.
- Toggle reminder opt-in on a shared wishlist page. Verify two `reminders` rows created with `invite_id` set.
- Click the unsubscribe link in a reminder email. Verify opt-in set to false and unsent reminders deleted.

---

## Acceptance Criteria
- [ ] Creating an important date schedules exactly 2 reminders (14-day, 3-day).
- [ ] Editing a date reschedules reminders to the new date.
- [ ] The cron job sends due reminder emails via Resend and marks them sent.
- [ ] Resend failures increment `retry_count` and are retried on the next cron run.
- [ ] After 5 failures, `permanently_failed=true` and the reminder stops being retried.
- [ ] Recurring dates are automatically advanced and rescheduled after the 3-day reminder fires.
- [ ] Giver Flow 2 opt-in creates correctly scheduled reminders.
- [ ] Unsubscribe link in email correctly removes future reminders.

---

## Future Improvements
- Push notification delivery (requires native app or web push setup).
- Custom reminder windows (e.g. 7 days, 1 month — user-configurable).
- "I got a gift!" confirmation in reminder email (one-click purchase tracking).
- SMS reminders via a Nigerian SMS gateway (Termii, Kudisms).
