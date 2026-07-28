# Feature: Order Tracking & Fulfillment

## Overview
The full lifecycle of a confirmed catalog order from the customer's perspective and the internal ops team's perspective. Internally: the ops team uses Retool to review confirmed orders, manually forward them to the correct dropshipping supplier (Spocket/CJDropshipping), and update order status as it progresses. Externally: customers receive email notifications at each status change and can view a live order tracker in their account.

---

## Goals
- Give customers real-time visibility into their order's progress.
- Notify customers proactively at every meaningful status change.
- Give the ops team a clean interface (via Retool) to manage order workflow.
- Maintain a complete, immutable history of every status transition.

---

## User Stories
- As a customer, I receive an email when my order status changes (confirmed, shipped, delivered).
- As a customer, I can view all my orders and their current status in my account.
- As a customer, I can click into an order and see a visual progress tracker and full history.
- As a customer, I can click a tracking link when my order ships.
- As an ops team member, I can see all confirmed orders in Retool and update their status.

---

## Functional Requirements
1. Status progression: `pending_payment` → `confirmed` → `under_review` → `forwarded` → `shipped` → `delivered`. Branch statuses: `payment_failed`, `cancelled`, `refunded`.
2. Every status change is logged to `order_status_history` via the `on_order_status_changed` trigger (append-only — never delete history rows).
3. Status can only move forward in the progression. A backward-status-move must be blocked at the API/Retool level (e.g. `shipped` cannot be set back to `forwarded`). Exception: `cancelled` and `refunded` can be set from any non-terminal status.
4. Customer-facing emails are sent for: `confirmed`, `shipped`, `delivered`, `cancelled`, `refunded`. Not sent for: `under_review`, `forwarded` (internal ops states — customer doesn't need these).
5. The `order_status_history` table has a `customer_notified` boolean — set to true when the customer email is sent.
6. Tracking link and carrier name stored on the `orders` row when status moves to `shipped` (set in Retool).
7. Orders list at `/account/orders` shows all orders grouped into tabs: Active (confirmed/under_review/forwarded/shipped), Completed (delivered), Cancelled.
8. Order detail at `/account/orders/[id]` shows a 4-step visual tracker: Order Placed → Processing → Shipped → Delivered.

---

## Non-Functional Requirements
- Customer emails must be sent within 5 minutes of a status change.
- The status history table is append-only — no UPDATE or DELETE on its rows.
- Retool connects to Supabase directly via service role — no Next.js API route is needed for ops status updates.

---

## UI Requirements

### `/account/orders` — Orders list

**Tabs:** "Active" | "Completed" | "Cancelled"

Each `OrderCard`:
- Order ID (short — last 8 chars of UUID)
- Date placed
- Item thumbnails (up to 3, then "+N more")
- Total amount
- Current status badge (color-coded: amber=processing, blue=shipped, green=delivered, red=cancelled)
- "View order" link → `/account/orders/[id]`

**Empty state per tab:** "No [active/completed/cancelled] orders."

### `/account/orders/[id]` — Order detail

**4-step visual progress tracker:**
```
[✓] Order Placed  →  [●] Processing  →  [ ] Shipped  →  [ ] Delivered
```
- Completed steps: filled brand circle with checkmark.
- Current step: brand outline circle, pulsing animation (GSAP).
- Future steps: muted outline circle.
- Line between steps: fills with brand color as steps complete.
- For cancelled orders: replace tracker with a "Cancelled" banner (red).

**Order summary:**
- Line items: image, title, variant, qty × price
- Subtotal, shipping, total

**Shipping details:**
- Name, phone, full address

**Tracking section** (shown when `status='shipped'` or `delivered`):
- Carrier name + tracking number
- "Track on [Carrier]" link (external, `tracking_url` stored on order)
- "Estimated delivery: [date]" (if stored)

**Status history timeline:**
- Expandable section "Order timeline"
- Each entry: status label, timestamp, notes (if any set by ops)

---

## Backend Logic

### `on_order_status_changed` trigger
```sql
CREATE OR REPLACE FUNCTION handle_order_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO order_status_history (
      order_id, status, changed_at, notes
    ) VALUES (
      NEW.id, NEW.status, NOW(), NEW.status_change_notes
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_status_changed
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_status_changed();
```

### Backward-status guard (Retool-level via a DB constraint or Postgres function)
Define a valid transition map and enforce it in a trigger:
```sql
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending_payment": ["confirmed", "payment_failed"],
    "payment_failed": ["pending_payment"],
    "confirmed": ["under_review", "cancelled"],
    "under_review": ["forwarded", "cancelled"],
    "forwarded": ["shipped", "cancelled"],
    "shipped": ["delivered", "cancelled"],
    "delivered": ["refunded"],
    "cancelled": [],
    "refunded": []
  }';
BEGIN
  IF NOT (valid_transitions->OLD.status @> to_jsonb(NEW.status)) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_order_status
  BEFORE UPDATE ON orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_order_status_transition();
```

### Customer notification emails (via cron or Supabase Edge Function)

**Option A (cron — simpler):** `/api/orders/notify` runs every 5 minutes. Queries `order_status_history WHERE customer_notified=false AND status IN ('confirmed', 'shipped', 'delivered', 'cancelled', 'refunded')`. Sends email via Resend. Sets `customer_notified=true`.

**Option B (Supabase Edge Function — more real-time):** Triggered via Supabase's database webhook on `order_status_history` INSERT. Fires immediately on any new history row for a customer-facing status.

**Recommendation for v1: Option A (cron)** — simpler to implement, consistent with the reminder and thank-you cron patterns already established.

```typescript
// POST /api/orders/notify (cron, CRON_SECRET protected)
const pending = await supabase
  .from('order_status_history')
  .select('*, orders(*, users(email, full_name), order_items(*))')
  .eq('customer_notified', false)
  .in('status', ['confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'])
  .limit(50)

for (const history of pending.data) {
  const emailContent = buildOrderStatusEmail(history)
  await resend.emails.send(emailContent)
  await supabase.from('order_status_history')
    .update({ customer_notified: true })
    .eq('id', history.id)
}
```

### Email templates per status

**`confirmed`:** "Your order is confirmed! We're reviewing it and will prepare it for shipment soon."

**`shipped`:** "Your order is on its way! Tracking number: [number]. Track it here: [link]."

**`delivered`:** "Your order has been delivered! We hope you love it. Leave a review: [link]."

**`cancelled`:** "Your order has been cancelled. [reason if provided]. Contact support if this was unexpected."

**`refunded`:** "Your refund has been processed. It may take 3–7 business days to appear."

---

## Database Changes

**`orders` table additions:**
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_change_notes TEXT; -- cleared after each transition, stored in history
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
```

**`order_status_history` table additions:**
```sql
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS notes TEXT;
```

**Full `order_status_history` table (verify in migrations):**
```sql
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_notified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
CREATE INDEX order_status_history_order_id_idx ON order_status_history(order_id);
CREATE INDEX order_status_history_unnotified_idx ON order_status_history(id) WHERE customer_notified = false;
```

---

## API Endpoints

### `GET /api/orders/[id]`
Fetch a single order with items and history.
**Auth:** required (owner).
**Response:** `{ order: OrderWithItemsAndHistory }`.

### `GET /api/orders`
List all orders for the current user.
**Auth:** required.
**Query params:** `?status=active|completed|cancelled` (maps to status groups).
**Response:** `{ orders: OrderCard[] }`.

### `POST /api/orders/notify` (cron)
Send pending customer status emails.
**Auth:** `CRON_SECRET`.
**Response:** `{ notified: number }`.

---

## Permissions and Authorization
- `orders` and `order_items`: customer can only read their own (RLS: `user_id = auth.uid()`).
- `order_status_history`: customer can read history for their own orders.
- All writes to `orders.status` happen via Retool with service role — no customer-facing status-change API.
- `validate_order_status_transition` trigger enforces valid transitions at the DB level, regardless of who writes.

---

## Validation
No customer-facing form submissions on these pages. The status transition validation lives entirely in the Postgres trigger.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Order not found | 404: "This order doesn't exist." |
| Status notification email fails | Increment retry_count (add to `order_status_history`), retry on next cron run |
| Invalid status transition in Retool | Postgres trigger raises exception → Retool shows an error, no state change |

---

## Loading and Empty States

- **Orders list:** skeleton `OrderCard` rows.
- **Empty active orders:** "No active orders. Start shopping in the gift museum."
- **Order detail:** skeleton of the 4-step tracker + summary.
- **No tracking info yet:** "Tracking details will appear once your order ships."

---

## Edge Cases

1. **Order cancelled after shipping.** The status can go from `shipped` to `cancelled` — the transition map allows this. The customer gets a cancellation email. A return/refund process would need to be handled manually for v1.

2. **Multiple items in one order shipped in separate packages.** The current data model has one `tracking_number` per order — doesn't support split shipments. For v1, ops team should note both tracking numbers in the `notes` field and the customer email. Split shipment support is a future improvement.

3. **Retool user accidentally skips a status** (e.g. marks an order `delivered` without going through `shipped`). The transition validation only checks immediate transitions — the map allows `forwarded → shipped → delivered` but not `forwarded → delivered` directly. The trigger will raise an exception. Retool must update sequentially.

4. **Customer's email bounces or is undeliverable.** Resend returns a failure. `customer_notified` stays false. The cron retries (up to 5 times). After 5 failures, add a `permanently_failed` flag equivalent (or check `retry_count` on the history row). The order status still changed — only the email failed.

5. **Customer orders the same product twice** (two separate `orders` rows). Both show in their orders list independently. No deduplication — this is intentional.

6. **Order contains an item from a wishlist that was subsequently deleted.** `orders.wishlist_item_id` references `wishlist_items(id)`. If the wishlist item is deleted, this FK needs `ON DELETE SET NULL` — the order history should survive even if the wishlist item is removed.

---

## Analytics / Events
- `order.status_changed` (from, to, order_id)
- `order.customer_notified` (status, delay_minutes from change to notification)
- `order.tracking_link_clicked`
- `order.detail.viewed`
- `orders.list.viewed` (tab: active | completed | cancelled)

---

## Testing Requirements

### Unit tests
- Status transition validation: all valid transitions pass; all invalid transitions throw.
- `buildOrderStatusEmail`: correct content for each status.

### Integration tests
- `on_order_status_changed` trigger: status change → history row inserted.
- Backward transition attempt → Postgres exception raised, no row inserted.
- Notification cron: history rows with `customer_notified=false` → emails sent, `customer_notified=true`.

### Manual QA
- Create a test order, manually advance status through the full lifecycle in Retool.
- Verify a customer email is received at each customer-facing status (confirmed, shipped, delivered).
- Verify the 4-step tracker on `/account/orders/[id]` reflects the correct current step.
- Verify tracking link appears on the detail page once `tracking_url` is set.

---

## Acceptance Criteria
- [ ] Every status change logs an immutable row to `order_status_history` via the trigger.
- [ ] Invalid status transitions are rejected at the DB level, not just the application level.
- [ ] Customer emails are sent for `confirmed`, `shipped`, `delivered`, `cancelled`, `refunded` within 5 minutes.
- [ ] The orders list correctly groups orders into Active/Completed/Cancelled tabs.
- [ ] The 4-step visual tracker correctly reflects the current status.
- [ ] Tracking link appears on the order detail page once `shipped` status and `tracking_url` are set.

---

## Future Improvements
- Automated order forwarding to Spocket/CJDropshipping via their APIs (eliminates manual Retool step).
- Real-time order status updates on the tracking page (Supabase Realtime).
- Split shipment tracking (multiple tracking numbers per order).
- Estimated delivery date calculation based on carrier + destination.
- "Report a problem" flow for wrong/damaged items.
