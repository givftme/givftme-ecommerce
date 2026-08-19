-- Migration 023: fix handle_order_status_changed() to satisfy
-- order_status_history.new_status's NOT NULL constraint
-- (16-ORDER-TRACKING.md)
--
-- Discovered live 2026-08-13 when manually moving a test order to
-- 'confirmed': the trigger's INSERT INTO order_status_history (order_id,
-- status, changed_at, notes) never supplied new_status, and unlike every
-- other column migration 019/022 didn't add, new_status is NOT NULL with
-- no default — confirmed via PostgREST's own OpenAPI schema
-- (GET /rest/v1/), not guessed at. Every real order status change was
-- failing this same way; migration 022 alone did not fully fix
-- order_status_history, only its status/changed_at gap.
--
-- old_status is nullable (no constraint violation for it), but populated
-- here too — the pre-existing old_status/new_status pair was evidently this
-- table's original design before migration 019 added the single-column
-- status model this app's code actually reads from, and there's no reason
-- to leave it silently null forever now that both values are available for
-- free in the trigger.

CREATE OR REPLACE FUNCTION handle_order_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (
      order_id, status, changed_at, notes, old_status, new_status
    ) VALUES (
      NEW.id, NEW.status, NOW(), NEW.status_change_notes, OLD.status, NEW.status
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
