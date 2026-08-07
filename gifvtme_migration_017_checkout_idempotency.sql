-- Migration 017: Checkout idempotency key.
--
-- `orders` has no migration file backing it (created live, like several
-- other tables predating this repo's migration numbering — see
-- DATABASE_SCHEMA.md). This migration only adds the one new column needed
-- to let POST /api/checkout dedupe retried submissions: a client-generated
-- key, checked before creating a new order.
--
-- Uniqueness is scoped per buyer, not global: the app only ever looks up
-- (and conflict-recovers) an idempotency key alongside buyer_id — see
-- POST /api/checkout — so the key only needs to be unique within one
-- buyer's own submissions. A global constraint would let a collision
-- between two different buyers' keys (implausible with UUIDs, but not
-- impossible given the non-UUID fallback generator in CheckoutForm.tsx)
-- permanently block the second buyer's checkout with an unrelated 500.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON public.orders (buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
