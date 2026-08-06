-- Migration 017: Checkout idempotency key.
--
-- `orders` has no migration file backing it (created live, like several
-- other tables predating this repo's migration numbering — see
-- DATABASE_SCHEMA.md). This migration only adds the one new column needed
-- to let POST /api/checkout dedupe retried submissions: a client-generated
-- key, unique per row, checked before creating a new order.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
