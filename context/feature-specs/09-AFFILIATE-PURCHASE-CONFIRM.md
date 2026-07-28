# Feature: Affiliate Redirect & Purchase Confirmation

## Overview
The complete external-item transaction flow. A giver is redirected to the retailer via an affiliate-tracked URL, completes the purchase externally, then returns to Gifvtme to confirm. On confirmation, a `purchases` row is created, the item is marked as claimed, and an automated thank-you is queued. Since Gifvtme cannot verify the external purchase, this flow depends on the giver's self-reported confirmation.

---

## Goals
- Redirect givers to the correct retailer page with affiliate tracking applied.
- Create an auditable `purchases` record when the giver confirms.
- Mark the wishlist item as claimed atomically (via the `on_purchase_created` DB trigger).
- Queue the automated thank-you message immediately on purchase creation.
- Handle the race condition where two givers attempt to claim the same item.

---

## User Stories
- As a giver, clicking "Buy on [Retailer]" takes me to the correct product page on the retailer's site.
- As a giver, after completing my purchase on the retailer's site, I return to Gifvtme to confirm.
- As a giver, if I didn't complete the purchase (changed my mind), I can say so and the item stays available.
- As a receiver, once a giver confirms, the item shows as "Claimed" and I receive an automated thank-you trigger.

---

## Functional Requirements
1. The "Buy on [Retailer]" button opens `wishlist_items.affiliate_url` in a new tab (not the same tab).
2. After clicking the buy button, the item detail page shows a confirmation prompt inline: "Did you complete your purchase on [Retailer]?"
3. "Yes, I bought it" routes to `/w/[id]/confirm/[itemId]` (the confirmation screen) or handles it inline — **design decision: inline is simpler and faster, but a dedicated screen allows the animated success state designed in mockups. Use dedicated screen.**
4. Route: `/w/[id]/confirm/[itemId]`.
5. Confirmation screen shows: item image + title, "Mark as gifted" CTA (filled), "I didn't buy it — go back" link.
6. On confirmation ("Mark as gifted"):
   - `POST /api/purchases` → creates a `purchases` row.
   - The `on_purchase_created` trigger: marks `wishlist_items.status = 'purchased'`, marks `master_items.status = 'purchased'` (if `master_item_id` is set), creates a `thank_you_messages` row with `type='auto'`.
   - On success: navigate to the "Claimed success" screen `/w/[id]/success/[itemId]`.
7. "I didn't buy it" → returns to the item detail page. Item remains available.
8. If the item has already been purchased by the time the giver clicks "Mark as gifted" (race condition): show "Someone else just claimed this!" graceful error, then redirect back to the wishlist.

---

## Non-Functional Requirements
- The purchase POST must be idempotent — if the giver double-taps, only one `purchases` row should be created (the DB constraint handles this; the API must catch the constraint violation gracefully).
- The confirmation screen must work on mobile — it's the most likely context for a giver returning from the retailer's app/site.

---

## UI Requirements

### Item detail page — inline confirmation prompt
Appears below the "Buy on [Retailer]" button after it's clicked. Slides in with a subtle GSAP animation.
```
"Did you complete your purchase on [Retailer]?"
[Yes, I bought it — filled button]  [No, not yet — ghost button]
```
The "No" button dismisses the prompt and re-shows the original buy button.

### Route: `/w/[id]/confirm/[itemId]`

**Header:** "← Back to wishlist" link.

**Card:**
- Item image (160px × 160px, rounded-2xl)
- "You're gifting:" label
- Item title (h2)
- Receiver name: "To [Receiver Name]"

**Actions:**
- "Mark as gifted 🎁" (filled button, full width)
- "I didn't complete the purchase" (text variant, below button)

**Loading state on confirm:** Button shows "Saving..." + spinner, disabled.

### Route: `/w/[id]/success/[itemId]` — Claimed success screen

**Celebration state:**
- GSAP confetti or sparkle animation on mount (brief, ~1.5s)
- "🎁 Gift marked!" heading
- "[Receiver Name] will love this!" sub-copy
- Item image + title (small, confirmatory)

**Reminder opt-in section** (if the viewer has an invite and hasn't opted in yet):
- "Want a reminder before [Receiver]'s [Occasion]?" 
- "Yes, remind me" button (saves `reminder_opted_in = true`)
- "No thanks" link

**Back CTA:** "View the rest of the wishlist" → navigates back to `/w/[id]`.

---

## Backend Logic

### `POST /api/purchases`
```typescript
// 1. Auth check — must be authenticated (Business Rule #2)
// 2. Validate body
const { wishlist_item_id } = purchaseSchema.parse(body)

// 3. Verify item exists and is accessible (not private, not already purchased)
const item = await supabase
  .from('wishlist_items_with_status')
  .select('id, status, wishlist_id')
  .eq('id', wishlist_item_id)
  .single()

if (!item) return 404
if (item.status === 'purchased') return 409 { error: 'already_purchased', message: 'Someone else just claimed this!' }

// 4. Insert purchase record
const { data, error } = await supabase
  .from('purchases')
  .insert({ wishlist_item_id, buyer_id: auth.uid() })
  .select()
  .single()

if (error?.code === '23505') { // unique constraint violation (one_purchase_per_item)
  return 409 { error: 'already_purchased', message: 'Someone else just claimed this!' }
}
if (error) return 500

// The on_purchase_created trigger handles:
//   - UPDATE wishlist_items SET status='purchased' WHERE id=$wishlist_item_id
//   - UPDATE master_items SET status='purchased' WHERE id=wishlist_items.master_item_id (if set)
//   - INSERT INTO thank_you_messages (purchase_id, wishlist_item_id, type='auto', message=receiver.default_thank_you_msg)

return 201 { purchase: data }
```

### `on_purchase_created` trigger (SQL — confirm in migrations)
```sql
CREATE OR REPLACE FUNCTION handle_new_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark wishlist item as purchased
  UPDATE wishlist_items SET status = 'purchased' WHERE id = NEW.wishlist_item_id;
  
  -- Mark master item as purchased (if linked)
  UPDATE master_items SET status = 'purchased'
  WHERE id = (SELECT master_item_id FROM wishlist_items WHERE id = NEW.wishlist_item_id);
  
  -- Create automated thank-you message
  INSERT INTO thank_you_messages (purchase_id, wishlist_item_id, type, message, receiver_id, buyer_id)
  SELECT
    NEW.id,
    NEW.wishlist_item_id,
    'auto',
    COALESCE(u.default_thank_you_msg, 'Thank you so much for the gift, I really appreciate you!'),
    wl.user_id,
    NEW.buyer_id
  FROM wishlist_items wi
  JOIN wishlists wl ON wl.id = wi.wishlist_id
  JOIN public.users u ON u.id = wl.user_id
  WHERE wi.id = NEW.wishlist_item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_purchase_created
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION handle_new_purchase();
```

---

## Database Changes
No new tables. Uses `purchases`, `wishlist_items`, `master_items`, `thank_you_messages`.

**Confirm `purchases` table schema:**
```sql
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id UUID NOT NULL REFERENCES wishlist_items(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_purchase_per_item UNIQUE (wishlist_item_id)
);
```
`ON DELETE RESTRICT` on `wishlist_item_id` — don't allow deleting a wishlist item that has a purchase record (protects history).

---

## API Endpoints

### `POST /api/purchases`
**Auth:** required.
**Body:** `{ wishlist_item_id: string }`
**Success (201):** `{ purchase: Purchase }`
**Already purchased (409):** `{ error: 'already_purchased', message: string }`
**Not found (404):** `{ error: 'Item not found' }`

---

## Permissions and Authorization
- `POST /api/purchases`: any authenticated user can mark an accessible (per wishlist visibility) item as purchased.
- RLS on `purchases`: buyer can see their own purchase records. Wishlist owner can see purchases on their items. Others have no access.

---

## Validation

```typescript
const purchaseSchema = z.object({
  wishlist_item_id: z.string().uuid(),
})
```

---

## Error Handling

| Scenario | User-facing message |
|---|---|
| Item already purchased (race condition) | "Someone else just claimed this gift! 🎁" + redirect back to wishlist |
| Item not found | "This item doesn't exist or was removed." |
| Not authenticated | Redirect to login with redirect param |
| Network error on confirm | "Couldn't save your purchase. Please try again." (idempotency means retry is safe) |

---

## Loading and Empty States
- "Mark as gifted" button: spinner + "Saving..." while POST is in flight.
- Success screen: GSAP celebration animation plays once on mount.

---

## Edge Cases

1. **Two givers submit the confirm at the exact same millisecond.** The `UNIQUE (wishlist_item_id)` constraint on `purchases` ensures only one succeeds. The second gets a 409 and is shown the "already claimed" message. This is the intended behavior.

2. **Giver confirms a purchase they didn't actually complete** (honesty issue). Gifvtme cannot detect this — accepted limitation of the affiliate model. The receiver may notice if the package never arrives, but there's no system-level remedy. Post-launch, a "report a problem" link on the claimed item could help.

3. **Giver returns to confirm days later.** The confirmation screen should still work — no expiry on the confirm flow. Confirm that the item hasn't been claimed by someone else in the interim (check status before the confirm POST).

4. **Giver accidentally closes the confirmation tab.** They can re-navigate to `/w/[id]/confirm/[itemId]` via the shared wishlist page (item still shows as available until confirmed). No automatic cleanup needed.

5. **Giver confirms, purchase is saved, but thank-you message trigger fails.** The DB trigger runs in the same transaction as the purchase INSERT. If the trigger fails, the purchase INSERT rolls back. This means a trigger bug blocks all purchases — test the trigger thoroughly. Consider making the thank-you creation a separate async job if this proves too fragile.

6. **Item with `is_exclusive=true` confirmed as purchased.** Functions identically — the only difference is that `master_items` update is skipped (since `master_item_id` is null). The trigger already handles this via the `WHERE id = (SELECT master_item_id ...)` query — if `master_item_id` is null, the UPDATE affects 0 rows (no error).

---

## Analytics / Events
- `purchase.confirm_screen_viewed` (origin: external)
- `purchase.confirmed` (item_id, buyer_id)
- `purchase.rejected` (giver said "I didn't buy it")
- `purchase.race_condition_hit` (two givers tried simultaneously — worth tracking for scale insights)

---

## Testing Requirements

### Unit tests
- `purchaseSchema` validation.
- `on_purchase_created` trigger: verify `wishlist_items.status`, `master_items.status`, and `thank_you_messages` row all created in the same transaction.

### Integration tests
- Happy path: POST to `/api/purchases` → purchases row created, item status = 'purchased', thank_you_messages row created.
- Race condition: two simultaneous POSTs for the same `wishlist_item_id` → exactly one succeeds, one 409.
- `ON DELETE RESTRICT` on purchase: deleting a purchased wishlist item is blocked.

### Manual QA
- Click "Buy on Jumia" from the item detail page — verify it opens in new tab and inline prompt appears.
- Navigate to `/w/[id]/confirm/[itemId]` directly — verify correct item shown.
- Click "Mark as gifted" — verify: purchase row in DB, item shows "Claimed" on shared wishlist, thank_you_messages row created.
- Open the same confirm page in two browsers simultaneously and click "Mark as gifted" in both quickly — verify only one purchase is created and the second sees the "already claimed" error.

---

## Acceptance Criteria
- [ ] "Buy on [Retailer]" opens the affiliate URL in a new tab and shows the inline confirm prompt.
- [ ] The confirm screen shows the correct item details.
- [ ] "Mark as gifted" creates a `purchases` row, marks the item as purchased, and triggers the thank-you message — atomically.
- [ ] The race condition (two simultaneous confirms) results in exactly one purchase and a graceful error for the second giver.
- [ ] "I didn't buy it" returns to the item detail page with the item still showing as available.
- [ ] Success screen shows a celebration animation and the reminder opt-in section.

---

## Future Improvements
- Automatic purchase detection via Flutterwave or retailer webhooks (eliminating the self-report step).
- "Gifting note" — let givers attach a personal message at purchase time.
- Purchase receipt upload (optional proof of purchase for high-value items).
