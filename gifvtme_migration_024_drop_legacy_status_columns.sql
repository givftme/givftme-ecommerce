-- Migration 024: drop order_status_history's legacy old_status/new_status/
-- changed_by/note columns (16-ORDER-TRACKING.md)
--
-- These predate this repo's migration history entirely (part of whatever
-- system originally created order_status_history before migration 019) and
-- duplicate what this app's own status/changed_at/notes columns already
-- carry. Their NOT NULL constraint on new_status is what forced migration
-- 023's workaround in handle_order_status_changed(), and this app's every
-- read of order_status_history has had to route around status in favor of
-- new_status since 2026-08-13 after status was observed mutating on
-- already-written rows for reasons never root-caused (see ROADMAP.md).
-- Developer decision: stop carrying two overlapping status models: drop
-- the legacy columns and let the trigger — and every query reading this
-- table — go back to the single, literal status column the spec always
-- assumed. If status still misbehaves after this, that at least rules out
-- old_status/new_status as the cause; if it doesn't, this was it.
--
-- changed_by/note were never populated or read by any code in this repo.

ALTER TABLE order_status_history DROP COLUMN IF EXISTS old_status;
ALTER TABLE order_status_history DROP COLUMN IF EXISTS new_status;
ALTER TABLE order_status_history DROP COLUMN IF EXISTS changed_by;
ALTER TABLE order_status_history DROP COLUMN IF EXISTS note;

-- Back to the literal migration 019 trigger — no longer needs to populate
-- columns that no longer exist.
CREATE OR REPLACE FUNCTION handle_order_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (
      order_id, status, changed_at, notes
    ) VALUES (
      NEW.id, NEW.status, NOW(), NEW.status_change_notes
    );

    IF NEW.status_change_notes IS NOT NULL THEN
      UPDATE orders SET status_change_notes = NULL WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
