-- Migration 019: Order Tracking & Fulfillment (16-ORDER-TRACKING.md)
--
-- `orders` and `order_status_history` already exist live (see
-- DATABASE_SCHEMA.md) with no migration file backing their original
-- creation, same situation migrations 015/016 found for `important_dates`/
-- `thank_you_messages`. This migration formally owns `order_status_history`
-- (CREATE TABLE IF NOT EXISTS + defensive ADD COLUMN IF NOT EXISTS, same
-- pattern) and adds the customer-tracking columns/triggers the spec needs.

-- ---------------------------------------------------------------------
-- orders: tracking + ops-notes columns
-- ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE;
-- Set by Retool alongside a status change; copied into
-- order_status_history.notes by the trigger below, then cleared so it never
-- describes a future, unrelated transition.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_change_notes TEXT;

-- ---------------------------------------------------------------------
-- order_status_history: formally own the schema
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_notified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS notes TEXT;
-- Not in the spec's literal Database Changes block, but required to
-- implement Edge Case #4 ("cron retries up to 5 times... permanently_failed
-- flag") and to give /api/orders/notify the same atomic-claim concurrency
-- guard /api/reminders and /api/thank-you/process already rely on, so two
-- overlapping cron invocations can't double-send the same status email.
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS permanently_failed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS order_status_history_unnotified_idx
  ON order_status_history(id) WHERE customer_notified = false;
CREATE INDEX IF NOT EXISTS order_status_history_claimable_idx
  ON order_status_history(id) WHERE customer_notified = false AND permanently_failed = false;

-- ---------------------------------------------------------------------
-- RLS: customers can read their own orders' status history
-- (order_status_history previously had no customer-facing read path since
-- no order-tracking UI existed yet)
-- ---------------------------------------------------------------------
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their own order history" ON order_status_history;
CREATE POLICY "Customers can read their own order history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Edge Case #6: wishlist item deletion must not take order history with it
-- ---------------------------------------------------------------------
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'orders'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'wishlist_item_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE orders
    ADD CONSTRAINT orders_wishlist_item_id_fkey
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_items(id) ON DELETE SET NULL;
END $$;

-- ---------------------------------------------------------------------
-- on_order_status_changed: append-only history log (spec's Backend Logic)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_order_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (
      order_id, status, changed_at, notes
    ) VALUES (
      NEW.id, NEW.status, NOW(), NEW.status_change_notes
    );

    -- Clear the ops note now that it's been copied into history, so it
    -- can't be mistaken for describing a later, unrelated transition.
    -- Status is unchanged on this nested update, so it does not recurse
    -- into the INSERT above.
    IF NEW.status_change_notes IS NOT NULL THEN
      UPDATE orders SET status_change_notes = NULL WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_changed ON orders;
CREATE TRIGGER on_order_status_changed
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_status_changed();

-- ---------------------------------------------------------------------
-- validate_order_status_transition: backward-status guard (spec's literal
-- transition map, implemented verbatim per 16-ORDER-TRACKING.md)
-- ---------------------------------------------------------------------
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

DROP TRIGGER IF EXISTS validate_order_status ON orders;
CREATE TRIGGER validate_order_status
  BEFORE UPDATE ON orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_order_status_transition();
