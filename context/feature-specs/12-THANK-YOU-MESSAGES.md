# Feature: Thank You Messages (Automated + Personal)

## Overview
Two-layer thank-you system. **Automated:** fires immediately when a purchase is confirmed (either flow), using the receiver's default message. **Personal:** the receiver can later compose and send a personal follow-up once they've received and opened the gift. Both are delivered via Resend email to the buyer. The receiver manages both from a "Gifts received" dashboard page.

---

## Goals
- Ensure every gift buyer gets an immediate acknowledgment without the receiver having to do anything.
- Give receivers a way to send a genuine personal note after the fact.
- Give receivers visibility into who bought what (their "gifts received" history).

---

## User Stories
- As a giver, I receive an automatic thank-you email as soon as my purchase is confirmed.
- As a receiver, I can see a list of all gifts people have bought for me.
- As a receiver, I can send a personal thank-you message to a specific gift-buyer whenever I'm ready.
- As a receiver, I can see which gifts I've already personally thanked someone for.

---

## Functional Requirements
1. Automated thank-you fires via the `on_purchase_created` trigger (external flow) and the `on_order_confirmed_thank_you` trigger (catalog flow, fires when `orders.status` changes to `confirmed`).
2. The automated message uses `public.users.default_thank_you_msg` for the receiver; falls back to the system default if null.
3. Automated thank-you is sent via Resend when the `/api/thank-you/process` cron job runs (every 5 minutes).
4. Personal thank-you: receiver composes a custom message from the dashboard; sent immediately via Resend on submit.
5. A receiver can send at most one personal thank-you per purchase/order (one per gift-giver per item — not an enforced DB constraint, but a UI guard to prevent accidental double-sends).
6. Automated thank-you rows are created with `type='auto'`, `sent=false`. Personal ones are created with `type='personal'` at compose time and sent immediately (not queued via cron).
7. The "Gifts received" page shows all purchases and confirmed orders associated with the receiver's wishlist items and orders.

---

## Non-Functional Requirements
- Automated thank-you email must be sent within 5 minutes of purchase confirmation.
- Personal thank-you send must complete within 3 seconds (direct Resend call, not queued).

---

## UI Requirements

### Route: `/dashboard/gifts`

**Page header:** "Gifts received" + item count badge.

**Filter tabs:** "All" | "External gifts" | "Gifvtme orders" (or just "All" | "To thank" | "Thanked")

**Gift card, per purchase/order item:**
- Item image (60×60px)
- Item title
- "Gifted by [Buyer Name]" (show name if buyer has a profile, else "Anonymous")
- Date purchased
- "Auto thank-you sent ✓" chip (muted, shown once auto thank-you has been sent)
- "Send personal thank-you" button (ghost, small) — shown if no personal thank-you sent yet
- "Personal thank-you sent ✓" chip — shown if already sent

**Personal thank-you compose sheet** (bottom sheet on mobile, dialog on desktop):
- Item image + title at top (context)
- "To: [Buyer Name]" (read-only)
- Textarea: "Your personal message" (required, max 1000 chars, character counter)
- Pre-fill with `default_thank_you_msg` as a starting point (editable)
- "Send thank-you" CTA (filled)
- "Cancel" link

**Empty state:** "No gifts yet — share your wishlist so people can start gifting!"

---

## Backend Logic

### Automated thank-you processing (cron)

**`POST /api/thank-you/process`** (runs every 5 minutes):
```typescript
// 1. Fetch unsent auto thank-you messages
const pending = await supabase
  .from('thank_you_messages')
  .select(`
    *,
    purchases(*, wishlist_items(title, image_url)),
    orders(*, order_items(title: product_title, image_url: product_image_url)),
    receiver:receiver_id(full_name, avatar_url),
    buyer:buyer_id(full_name, email)
  `)
  .eq('type', 'auto')
  .eq('sent', false)
  .eq('permanently_failed', false)
  .limit(50)

for (const msg of pending.data) {
  try {
    const itemTitle = msg.purchases?.wishlist_items?.title
      || msg.orders?.order_items?.[0]?.title
      || 'your gift'
    
    await resend.emails.send({
      to: msg.buyer.email,
      from: process.env.RESEND_FROM_EMAIL,
      subject: `🎁 ${msg.receiver.full_name} says thank you!`,
      html: buildAutoThankYouEmail({ message: msg.message, receiverName: msg.receiver.full_name, itemTitle, receiverAvatar: msg.receiver.avatar_url }),
    })
    
    await supabase.from('thank_you_messages')
      .update({ sent: true, sent_at: new Date() })
      .eq('id', msg.id)
  } catch (err) {
    const newRetryCount = (msg.retry_count || 0) + 1
    await supabase.from('thank_you_messages').update({
      retry_count: newRetryCount,
      permanently_failed: newRetryCount >= 5,
    }).eq('id', msg.id)
  }
}
```

### `on_order_confirmed_thank_you` trigger (catalog flow)
Fires when `orders.status` changes to `'confirmed'`:
```sql
CREATE OR REPLACE FUNCTION handle_order_confirmed_thank_you()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO thank_you_messages (
      order_id, receiver_id, buyer_id, type, message, sent
    )
    SELECT
      NEW.id,
      wl.user_id,        -- receiver is the wishlist owner (if order tied to a wishlist)
      NEW.user_id,       -- buyer
      'auto',
      COALESCE(u.default_thank_you_msg, 'Thank you so much for the gift, I really appreciate you!'),
      false
    FROM orders o
    LEFT JOIN wishlist_items wi ON wi.id = o.wishlist_item_id
    LEFT JOIN wishlists wl ON wl.id = wi.wishlist_id
    JOIN public.users u ON u.id = wl.user_id
    WHERE o.id = NEW.id
      AND o.wishlist_item_id IS NOT NULL; -- only create thank-you for wishlist-originated orders
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_confirmed_thank_you
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_confirmed_thank_you();
```

### Send personal thank-you
```typescript
// POST /api/thank-you/[purchaseOrOrderId]/personal

// 1. Auth check — must be the receiver (wishlist owner)
// 2. Validate message
// 3. Fetch buyer email
// 4. Send immediately via Resend:
await resend.emails.send({
  to: buyer.email,
  from: process.env.RESEND_FROM_EMAIL,
  subject: `💌 A personal message from ${receiver.full_name}`,
  html: buildPersonalThankYouEmail({ message, receiverName: receiver.full_name, itemTitle }),
})
// 5. INSERT INTO thank_you_messages (type='personal', sent=true, sent_at=now(), message, ...)
```

### "Gifts received" page data
```typescript
// Fetch all purchases on the receiver's wishlist items:
const externalGifts = await supabase
  .from('purchases')
  .select('*, wishlist_items!inner(*, wishlists!inner(user_id)), buyer:buyer_id(full_name, avatar_url)')
  .eq('wishlist_items.wishlists.user_id', userId)

// Fetch all confirmed catalog orders on the receiver's wishlist items:
const catalogGifts = await supabase
  .from('orders')
  .select('*, order_items(*), buyer:user_id(full_name, avatar_url)')
  .eq('wishlist_item_id', '<ids from receiver's wishlist items>')
  .in('status', ['confirmed', 'under_review', 'forwarded', 'shipped', 'delivered'])

// Merge and sort by created_at desc
```

---

## Database Changes

**`thank_you_messages` table** — verify all columns exist (migration 004):
```sql
CREATE TABLE IF NOT EXISTS thank_you_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  wishlist_item_id UUID REFERENCES wishlist_items(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('auto', 'personal')),
  message TEXT NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  permanently_failed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Exactly one of purchase_id or order_id must be set:
  CONSTRAINT purchase_or_order_required CHECK (
    (purchase_id IS NOT NULL AND order_id IS NULL) OR
    (order_id IS NOT NULL AND purchase_id IS NULL)
  )
);
```

**`vercel.json` cron:**
```json
{ "path": "/api/thank-you/process", "schedule": "*/5 * * * *" }
```

---

## API Endpoints

### `POST /api/thank-you/process` (cron)
Process pending auto thank-you messages.
**Auth:** `Authorization: Bearer ${CRON_SECRET}`.
**Response:** `{ processed: number, failed: number }`.

### `POST /api/thank-you/[id]/personal`
Send a personal thank-you for a specific purchase or order.
**Auth:** required (must be the receiver).
**Body:** `{ message: string }`
**Response:** `{ sent: true }`.

### `GET /api/dashboard/gifts`
Fetch all gifts received (purchases + catalog orders on receiver's items).
**Auth:** required.
**Response:** `{ gifts: GiftReceived[] }`.

---

## Permissions and Authorization
- `thank_you_messages`: receiver can read and create personal messages for their own gifts. Buyer can read messages sent to them. Neither can read the other's records beyond their own.
- `/api/thank-you/[id]/personal`: verify `receiver_id = auth.uid()` before sending.
- Cron route: `CRON_SECRET` header only.

---

## Validation

```typescript
const personalThankYouSchema = z.object({
  message: z.string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message must be under 1000 characters"),
})
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Auto thank-you Resend failure | Increment `retry_count`; retry on next cron run (every 5 min) |
| 5 Resend failures | `permanently_failed=true`; stop retrying; surface in monitoring |
| Personal thank-you Resend failure | Return 500 to client: "Couldn't send your message. Please try again." |
| Buyer has no email (shouldn't happen but defensive) | Skip sending, mark `permanently_failed=true`, log |
| No wishlist_item_id on order (direct purchase, not from wishlist) | No thank-you created — correct behavior, no receiver to thank |

---

## Loading and Empty States

- **Gifts page loading:** skeleton cards.
- **Empty state:** illustrated gift box, "No gifts yet" copy, "Share your wishlist" CTA.
- **Personal thank-you compose:** textarea pre-filled with `default_thank_you_msg` (if set); spinner on submit.
- **Already sent personal thank-you:** "Personal thank-you sent ✓" chip replaces the button.

---

## Edge Cases

1. **Buyer has no Gifvtme account** (purchased an external item without confirming on Gifvtme). In this flow, a `purchases` row still requires an authenticated `buyer_id` (Business Rule #2). So a buyer without an account can't trigger the purchase confirm step — they just don't click "Mark as gifted" and the item stays available. No orphan thank-you scenarios.

2. **Receiver hasn't set `default_thank_you_msg`.** Falls back to the system default string. The receiver should be nudged (via the profile page banner) to set a custom one. But the system default is a good enough fallback.

3. **Order with multiple `order_items`** (buyer purchased 3 catalog items for the receiver in one cart). One order → one `on_order_confirmed_thank_you` trigger call → one thank-you message covering the whole order. The message mentions "your gift" generically (or the first item title). This is acceptable — a personal thank-you can be more specific.

4. **Receiver sends a personal thank-you multiple times.** The UI should guard against this (replace the button with a "sent" indicator after first send). If somehow the API is called twice, it creates a second `thank_you_messages` row and sends a second email — no hard constraint prevents this. UI guard is the primary defense.

5. **Buyer deletes their account after sending a gift but before receiving the thank-you.** The `buyer_id` FK uses `ON DELETE RESTRICT` on `purchases` — account deletion is blocked if the user has purchase records. This needs to be addressed in the account deletion flow (see `02-PROFILE-MANAGEMENT.md` edge case #5).

6. **`order_id` path for catalog gifts.** The `on_order_confirmed_thank_you` trigger only fires for orders with `wishlist_item_id` set. A buyer purchasing directly from the shop (not from someone's wishlist) generates no thank-you message — correct, since there's no receiver to thank.

---

## Analytics / Events
- `thank_you.auto.queued`
- `thank_you.auto.sent` (delay_minutes from purchase to send)
- `thank_you.auto.failed` (retry_count)
- `thank_you.personal.sent`
- `thank_you.personal.compose_opened`

---

## Testing Requirements

### Unit tests
- `buildAutoThankYouEmail`: correct subject/body structure.
- `buildPersonalThankYouEmail`: correct structure.
- `personalThankYouSchema`: valid/invalid message lengths.

### Integration tests
- `on_purchase_created` trigger: auto thank-you row created for external purchase.
- `on_order_confirmed_thank_you` trigger: fires only when status changes to `confirmed`, only for wishlist-originated orders.
- Cron: pending auto thank-you → Resend called, `sent=true`.
- Cron: Resend failure → `retry_count++`, not marked sent.
- Personal thank-you POST: Resend called immediately, `thank_you_messages` row created with `sent=true`.

### Manual QA
- Complete an external purchase confirmation → wait up to 5 minutes → verify buyer receives auto thank-you email.
- Complete a Flutterwave catalog purchase → verify order confirmed → auto thank-you email sent to buyer.
- From the gifts page, click "Send personal thank-you" → compose → send → verify email received by buyer.
- Verify the "sent ✓" chip appears after sending and the button is replaced.

---

## Acceptance Criteria
- [ ] Every confirmed external purchase creates an auto `thank_you_messages` row via the DB trigger.
- [ ] Every confirmed catalog order (with `wishlist_item_id`) creates an auto `thank_you_messages` row via the DB trigger.
- [ ] The cron sends auto thank-yous within 5 minutes of purchase confirmation.
- [ ] Resend failures increment `retry_count` and are retried; 5 failures = `permanently_failed`.
- [ ] The "Gifts received" page shows all external purchases and confirmed catalog orders for the receiver's items.
- [ ] A receiver can compose and immediately send a personal thank-you from the dashboard.
- [ ] The personal thank-you button is replaced with a "sent ✓" indicator after sending.

---

## Future Improvements
- In-app thank-you messages (not just email) — notification in the buyer's Gifvtme account.
- Thank-you with a photo ("Here's me using your gift!").
- Scheduled personal thank-yous ("Send this on Christmas day").
- Thank-you message templates beyond the single default.
