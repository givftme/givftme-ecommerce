-- Migration 035: Make checkout address saves idempotent per order.
-- A buyer can enable save-for-next-time on a retry that reuses the order key.
-- The unique index also prevents concurrent after() callbacks from adding the
-- same order's address more than once.

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS saved_from_order_id uuid
  REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS addresses_saved_from_order_id_idx
  ON public.addresses (saved_from_order_id)
  WHERE saved_from_order_id IS NOT NULL;
