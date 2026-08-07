-- Migration 018: Atomic order + order_items creation.
--
-- POST /api/checkout previously inserted `orders` and `order_items` as two
-- separate, independently-committed statements. Between them, a fully
-- visible `orders` row existed with zero `order_items` rows. A concurrent
-- request with the same `idempotency_key` (a network retry, a double
-- submit) could look up that row — via either the pre-insert idempotency
-- check or the unique-violation race branch in POST /api/checkout — and
-- re-initiate Flutterwave payment against an order with no items, or race
-- against the compensating delete if the first request's order_items
-- insert then failed.
--
-- Wrapping both inserts in one plpgsql function makes the whole thing one
-- Postgres transaction: under the default READ COMMITTED isolation level,
-- no other request can see the order until it commits with its items
-- already in place. This is the same transactional-RPC pattern already
-- used by `gifvtme_create_occasion_with_wishlist` (migration 005/010).
--
-- Also adds `orders.payment_claimed_at`, set to now() as part of this same
-- insert. Without it, a concurrent idempotent replay (see the 23505 comment
-- below) could initiate a *second*, independent Flutterwave payment session
-- for this same order in the instant between this transaction committing
-- and this request's own initiateFlutterwavePayment call — see
-- lib/checkout/reinitiatePayment.ts, which claims/releases this same column
-- for /api/checkout/retry and the idempotency-replay path.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.gifvtme_create_checkout_order(
  p_buyer_id uuid,
  p_idempotency_key text,
  p_total_amount numeric,
  p_currency text,
  p_shipping_name text,
  p_shipping_email text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_state text,
  p_wishlist_item_id uuid,
  p_order_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  created_order_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_buyer_id THEN
    RAISE EXCEPTION 'Cannot create an order for another user.';
  END IF;

  IF jsonb_array_length(p_order_items) < 1 THEN
    RAISE EXCEPTION 'An order needs at least one item.';
  END IF;

  INSERT INTO public.orders (
    buyer_id,
    total_amount,
    currency,
    status,
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_city,
    shipping_state,
    wishlist_item_id,
    idempotency_key,
    payment_claimed_at
  )
  VALUES (
    p_buyer_id,
    p_total_amount,
    p_currency,
    'pending_payment',
    p_shipping_name,
    p_shipping_email,
    p_shipping_phone,
    p_shipping_address,
    p_shipping_city,
    p_shipping_state,
    p_wishlist_item_id,
    p_idempotency_key,
    now()
  )
  RETURNING id INTO created_order_id;

  INSERT INTO public.order_items (
    order_id,
    catalog_product_id,
    product_title,
    product_image_url,
    supplier_id,
    supplier_product_id,
    quantity,
    unit_price
  )
  SELECT
    created_order_id,
    item->>'catalog_product_id',
    item->>'product_title',
    item->>'product_image_url',
    item->>'supplier_id',
    item->>'supplier_product_id',
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric
  FROM jsonb_array_elements(p_order_items) AS item;

  RETURN created_order_id;
END;
$$;

-- Not caught here: if p_idempotency_key collides with a concurrent request
-- that's still mid-transaction, the unique index on orders.idempotency_key
-- (migration 017) blocks this INSERT until the other transaction commits or
-- rolls back, then raises unique_violation (23505) if it committed. That
-- propagates straight out to the caller — POST /api/checkout already
-- handles a 23505 from this RPC exactly like it handled one from the old
-- direct orders insert, by re-selecting the now-guaranteed-complete row.

GRANT EXECUTE ON FUNCTION public.gifvtme_create_checkout_order(
  uuid, text, numeric, text, text, text, text, text, text, text, uuid, jsonb
) TO authenticated;
