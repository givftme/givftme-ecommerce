-- Migration 039: allow general gift pools without a wishlist item.
--
-- Migration 036 extends a previously reserved group_gift_pools table. If that
-- table already had wishlist_item_id defined NOT NULL, ADD COLUMN IF NOT
-- EXISTS does not alter the existing constraint, which blocks general pools.

BEGIN;

ALTER TABLE public.group_gift_pools
  ALTER COLUMN wishlist_item_id DROP NOT NULL;

COMMIT;
