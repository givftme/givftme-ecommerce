-- Migration 022: fix order_status_history's missing status/changed_at
-- columns (16-ORDER-TRACKING.md)
--
-- Discovered via a live read-only schema check 2026-08-12 (not guessed):
-- `order_status_history` existed before migration 019 with a DIFFERENT
-- shape than migration 019 assumed — `old_status`/`new_status`/
-- `changed_by`/`created_at`, not `status`/`changed_at`. Migration 019's
-- `CREATE TABLE IF NOT EXISTS order_status_history (...)` silently no-opped
-- against the pre-existing table, and `status`/`changed_at` were declared
-- only inside that no-opped block — never as their own
-- `ADD COLUMN IF NOT EXISTS`, unlike customer_notified/notes/retry_count/
-- permanently_failed/claimed_at, which DID get added correctly by their own
-- explicit ALTER statements and are confirmed present live.
--
-- Net effect: handle_order_status_changed() (migration 019) inserts into
-- (order_id, status, changed_at, notes) — columns that don't exist — so the
-- trigger fails with a real Postgres error the moment any order's status
-- actually changes, rolling back the whole UPDATE. This has very likely
-- never fired for real yet (Retool isn't set up against this project per
-- ROADMAP.md's "Not started" section), but will break the first Retool
-- status change otherwise.
--
-- Columns are added nullable rather than NOT NULL (migration 019's original
-- CREATE TABLE declared them NOT NULL) — safer for an ALTER against a live
-- table with rows already in it, and unnecessary anyway since the trigger
-- always supplies both values on every new insert going forward.
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT NOW();

-- Best-effort backfill so the order tracking UI's history timeline isn't
-- blank for rows written before this fix. new_status/created_at are the
-- closest live equivalents of what status/changed_at were meant to hold.
UPDATE order_status_history
SET status = new_status
WHERE status IS NULL AND new_status IS NOT NULL;

UPDATE order_status_history
SET changed_at = created_at
WHERE changed_at IS NULL AND created_at IS NOT NULL;
