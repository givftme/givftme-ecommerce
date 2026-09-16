-- Persist the original checkout price warning in the order-creation transaction.
-- Apply before deploying the route that selects orders.price_changes.
-- Legacy orders have no recoverable client display price; leave their list empty.
-- Keep the RPC signature and invoker permissions from migration 018 unchanged.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS price_changes jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(price_changes) = 'array');

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
    payment_claimed_at,
    price_changes
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
    now(),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', item->>'product_title',
          'old_price', (item->>'display_price')::numeric,
          'new_price', (item->>'unit_price')::numeric
        ) ORDER BY position
      )
      FROM jsonb_array_elements(p_order_items) WITH ORDINALITY AS items(item, position)
      WHERE (item->>'display_price')::numeric <> (item->>'unit_price')::numeric
    ), '[]'::jsonb)
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


COMMIT;
