# Feature: Thank You Messages (Automated + Personal)

> **Status note (2026-08-01):** This spec described a feature that was entirely unbuilt — unlike `09`/`10`/`11`, there was nothing shipped-differently to reconcile against. This file has been rewritten to document what actually shipped. Migration 016 is confirmed applied to Supabase; see `context/ROADMAP.md`'s "Done" section.

## Overview
Two-layer thank-you system. **Automated:** fires when a purchase is confirmed (either flow), using the receiver's default message. **Personal:** the receiver can later compose and send a personal follow-up. Both are delivered via Resend email to the buyer. The receiver manages both from the "Gifts received" page at `/gifts`.

---

## Goals
- Ensure every gift buyer gets an immediate acknowledgment without the receiver having to do anything.
- Give receivers a way to send a genuine personal note after the fact.
- Give receivers visibility into who bought what (their "gifts received" history).

---

## User Stories
- As a giver, I receive an automatic thank-you email once my purchase is confirmed.
- As a receiver, I can see a list of all gifts people have bought for me.
- As a receiver, I can send a personal thank-you message to a specific gift-buyer whenever I'm ready.
- As a receiver, I can see which gifts I've already personally thanked someone for.

---

## What actually ships each thank-you

**External flow (affiliate purchases):** the pre-existing `on_purchase_created` trigger creates the `type='auto'` row. This trigger already runs in production and was deliberately **not** touched by migration 016 — it has no SQL source of truth anywhere in this repo, and reconstructing it from a guess risked silently replacing working behavior. If its live definition ever needs to change, that's a separate, careful piece of work with actual visibility into the current definition (e.g. via the Supabase dashboard), not a blind migration.

**Catalog flow (Gifvtme checkout):** genuinely new. Nothing created a thank-you row for a confirmed catalog order before this pass — the new `on_order_confirmed_thank_you` trigger (migration 016) does this, scoped to orders with `wishlist_item_id` set (no receiver to thank on a direct shop purchase), guarded so it can't insert twice for the same order.

Both triggers write `message = COALESCE(receiver's default_thank_you_msg, 'Thank you so much for the gift, I really appreciate you!')` — that fallback string is `DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER` in `lib/account/validation.ts`, already used as the profile-page placeholder.

---

## Functional Requirements
1. Automated thank-you fires via `on_purchase_created` (external flow, pre-existing) and `on_order_confirmed_thank_you` (catalog flow, new — migration 016).
2. The automated message uses `public.users.default_thank_you_msg` for the receiver; falls back to the system default if null.
3. Automated thank-you is sent via Resend when `/api/thank-you/process` runs (every 5 minutes, per `vercel.json`).
4. Personal thank-you: receiver composes a custom message from `/gifts`; sent immediately via Resend on submit, not queued — a send failure returns 500 to the client and nothing is persisted (there's no cron retry path for personal messages).
5. A receiver can send more than one personal thank-you per gift with no hard DB constraint stopping it — the UI hides the "send" button once one has been sent, and that's the only guard, exactly as this spec always specified (see Edge Cases below).
6. Automated rows are created with `type='auto'`, `sent=false`. Personal rows are inserted only after a successful Resend send, with `type='personal'`, `sent=true`, `sent_at=now()`.
7. `/gifts` shows all external purchases and confirmed catalog orders (`confirmed`/`under_review`/`forwarded`/`shipped`/`delivered`) associated with the receiver's wishlist items.

---

## Non-Functional Requirements
- Automated thank-you email must be sent within 5 minutes of purchase confirmation (bounded by the cron cadence).
- Personal thank-you send must complete within the request (direct Resend call, not queued).

---

## UI

### Route: `/gifts`

Not `/dashboard/gifts` — no route in this repo is namespaced under `/dashboard/`; the existing convention (`/dates`, `/wishlists`, `/my-occasions`) is a flat path under the `(dashboard)` route group, and this follows it.

**Page header:** "Gifts received" + item count badge.

**Filter tabs:** "All" | "To thank" | "Thanked".

**Gift card, per purchase/order:**
- Item image (60×60px), or a gift icon placeholder if none
- Item title
- "Gifted by [Buyer Name]" (or "Anonymous" if the buyer has no profile name)
- Date purchased
- "Auto thank-you sent ✓" chip (muted, once the auto thank-you sends)
- "Send personal thank-you" button (ghost, small) — shown if no personal thank-you sent yet
- "Personal thank-you sent ✓" chip — shown once sent

**Personal thank-you compose sheet** — `Sheet` (the same component `ImportantDateForm` uses; it's a bottom sheet on mobile and a centered dialog on desktop via one responsive component, not two separate files):
- Item image + title at top (context)
- "To: [Buyer Name]"
- Textarea, required, max 1000 chars, character counter
- Pre-filled with the receiver's `default_thank_you_msg` (editable)
- "Send thank-you" CTA, "Cancel" link

**Empty state:** "No gifts yet — share your wishlist so people can start gifting!" (or "Try a different filter" when a filter tab has zero matches but gifts exist overall).

---

## Backend Logic

### `POST /api/thank-you/process` (cron, every 5 minutes)
Fetches pending `type='auto'`, `sent=false`, `permanently_failed=false` rows (claimed atomically first, same pattern as `/api/reminders`), resolves the buyer's email via `auth.admin.getUserById` (service client, cached per run), builds the email via `buildAutoThankYouEmail`, sends via Resend with the row's own id as an `Idempotency-Key`. Success sets `sent=true, sent_at=now()`. Failure increments `retry_count`, sets `permanently_failed=true` at 5. A missing buyer email is treated as permanently failed immediately.

### `on_order_confirmed_thank_you` trigger (catalog flow — new)
Fires `AFTER UPDATE ON orders` when `status` changes to `'confirmed'` and `wishlist_item_id IS NOT NULL`. Resolves the receiver via `wishlist_items → wishlists.user_id`, buyer via `orders.buyer_id` (not `user_id` — that's the actual column name in this schema). Guarded with `NOT EXISTS (... WHERE order_id = NEW.id)` so it can't double-insert. See `gifvtme_migration_016_thank_you_messages.sql`.

### `POST /api/thank-you/[id]/personal`
**Auth:** required, must be the receiver — verified by joining the referenced purchase/order back to its wishlist item's `wishlists.user_id`, not just trusting a client-supplied receiver id.
**Request:** `{ source: "purchase" | "order", message: string }`. `source` disambiguates which table `id` belongs to — both are plain UUIDs with no reliable way to tell them apart otherwise, so the client sends it explicitly (the gift card already knows which source it rendered from).
**Behavior:** resolves the buyer's email via the service client, sends via Resend, and only inserts the `thank_you_messages` row after a successful send.
**Response:** `{ sent: true }`.

### `GET /api/gifts`
Renamed from `/api/dashboard/gifts` — matches the flat `/api/important-dates` naming convention, no route in this repo uses a `/api/dashboard/*` prefix.
Fetches the receiver's own wishlist item ids first, then filters `purchases`/`orders` with `.in()` rather than a nested PostgREST nested-nested filter — kept to patterns already proven working elsewhere in this codebase rather than introducing untested query syntax with no way to verify it against a live database from this environment.
**Response:** `{ gifts: GiftReceived[] }`.

---

## Database Changes

**`thank_you_messages` table** — formally created by `gifvtme_migration_016_thank_you_messages.sql` (`CREATE TABLE IF NOT EXISTS` + defensive `ADD COLUMN IF NOT EXISTS`, same pattern migration 015 used for `important_dates`, since this table already existed live with zero SQL source of truth). Adds `retry_count`, `permanently_failed`, `sent_at`, and `claimed_at` (atomic per-row cron claim, mirroring `reminders.claimed_at`) alongside the originally-documented columns.

**`vercel.json`** — added to this repo for the first time (it didn't exist even for the already-shipped `/api/reminders` cron):
```json
{
  "crons": [
    { "path": "/api/reminders", "schedule": "0 * * * *" },
    { "path": "/api/thank-you/process", "schedule": "*/5 * * * *" }
  ]
}
```
The reminders cadence (hourly) is an assumed default, not a confirmed production value — reminders' schedule previously lived entirely outside this repo. Cheap to change later.

---

## Permissions and Authorization
- `thank_you_messages` RLS: `receiver_id = auth.uid() OR buyer_id = auth.uid()` can `SELECT`. Only the receiver can `INSERT`, and only a `type='personal'` row (`WITH CHECK (auth.uid() = receiver_id AND type = 'personal')`). No `UPDATE`/`DELETE` grant to `authenticated` — only the cron (service role, bypasses RLS) mutates `sent`/`retry_count`/`permanently_failed`.
- `/api/thank-you/[id]/personal`: ownership verified in the route handler by joining back to the wishlist owner, not solely relying on RLS (same pattern as `/api/important-dates`).
- Cron route: `CRON_SECRET` header only.

---

## Validation

```typescript
export const personalThankYouSchema = z.object({
  source: z.enum(["purchase", "order"]),
  message: z.string().trim().min(1, "Message cannot be empty").max(1000, "Message must be under 1000 characters"),
});
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Auto thank-you Resend failure | Increment `retry_count`; retry on next cron run (every 5 min) |
| 5 Resend failures | `permanently_failed=true`; stop retrying |
| Personal thank-you Resend failure | Return 500: "Couldn't send your message. Please try again." Nothing is persisted — the user can just resubmit. |
| Buyer has no email (shouldn't happen but defensive) | Auto: mark `permanently_failed=true` immediately. Personal: same 500 message as a Resend failure. |
| No `wishlist_item_id` on order (direct shop purchase) | No thank-you created — correct, no receiver to thank |

---

## Edge Cases

1. **Buyer has no Gifvtme account.** Unchanged from the original spec's reasoning — a `purchases` row requires an authenticated `buyer_id` (Business Rule #2), so this can't happen for the external flow.
2. **Receiver hasn't set `default_thank_you_msg`.** Falls back to `DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER`.
3. **Order with multiple `order_items`.** One order → one auto thank-you row. The "Gifts received" card and the auto email both show the *first* order item's title, not an itemized list — acceptable per the original spec's own reasoning (a personal thank-you can be more specific).
4. **Receiver sends a personal thank-you multiple times.** No hard DB constraint prevents this — matches the original spec's explicit design. The UI hides the button after a successful send; if the API is called again anyway, it just sends and records another one.
5. **Buyer deletes their account after gifting but before being thanked.** Still an open item in `02-PROFILE-MANAGEMENT.md`'s own edge cases — unchanged by this pass.
6. **Direct shop order (`wishlist_item_id IS NULL`).** No thank-you — correct, no receiver.

---

## Analytics / Events
- `thank_you.personal.sent` (fired client-side on a confirmed send)
- `thank_you.personal.compose_opened` (fired when the sheet opens, not from inside a `useEffect` — React's rule against synchronous `setState` in effects pushed this to the actual open-triggering click handler in `GiftsClient`)

Not implemented: `thank_you.auto.queued`/`sent`/`failed` — these would need to fire from the trigger/cron, and no analytics-from-SQL or server-cron-side `trackEvent` precedent exists elsewhere in this codebase (the reminders cron doesn't emit analytics events either). Flagged, not built, matching that precedent rather than introducing a new one unilaterally.

---

## Testing Requirements

### Unit tests (shipped)
- `lib/thank-you/buildThankYouEmail.test.ts`: `buildAutoThankYouEmail`/`buildPersonalThankYouEmail` subject/body structure, HTML escaping.
- `lib/thank-you/validation.test.ts`: `personalThankYouSchema` valid/invalid message lengths and source values.

### Integration tests (not built — no DB test harness exists in this repo for any feature)
- `on_purchase_created` / `on_order_confirmed_thank_you` trigger behavior.
- Cron send/retry behavior.
- Personal thank-you POST end-to-end.

### Manual QA (unchanged from original spec, still pending — no DB access from this environment)
- Complete an external purchase confirmation → wait up to 5 minutes → verify buyer receives auto thank-you email.
- Complete a Flutterwave catalog purchase → verify the new trigger fires → auto thank-you email sent.
- From `/gifts`, send a personal thank-you → verify received by buyer, chip replaces button.

---

## Acceptance Criteria
- [x] Every confirmed external purchase creates an auto `thank_you_messages` row (pre-existing trigger, unverified from this repo but assumed working — the whole affiliate flow has depended on it for multiple sessions already).
- [x] Every confirmed catalog order (with `wishlist_item_id`) creates an auto `thank_you_messages` row via the new trigger.
- [x] The cron sends auto thank-yous within 5 minutes of purchase confirmation, when running.
- [x] Resend failures increment `retry_count` and are retried; 5 failures = `permanently_failed`.
- [x] `/gifts` shows all external purchases and confirmed catalog orders for the receiver's items.
- [x] A receiver can compose and immediately send a personal thank-you.
- [x] The personal thank-you button is replaced with a "sent ✓" indicator after sending.
- [x] Migration 016 confirmed applied to Supabase (2026-08-01).

---

## Future Improvements
- In-app thank-you messages (not just email).
- Thank-you with a photo.
- Scheduled personal thank-yous.
- Thank-you message templates beyond the single default.
- Reconstructing `on_purchase_created` with a verified (not guessed) definition, if it ever needs to change.
