-- Migration 040: allow inserts into the active pool schema when an older
-- reserved group_gift_pools table still has its unused goal_amount column.
--
-- The active feature stores its target in target_amount. Some earlier table
-- versions retained goal_amount as NOT NULL, which rejects inserts that do
-- not include this legacy column.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = to_regclass('public.group_gift_pools')
      AND attname = 'goal_amount'
      AND attnotnull
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.group_gift_pools
      ALTER COLUMN goal_amount DROP NOT NULL;
  END IF;
END;
$$;

COMMIT;
