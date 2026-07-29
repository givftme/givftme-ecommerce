-- Migration 010: Fix a Postgres syntax bug in gifvtme_create_occasion_with_wishlist
-- (migration 005). `WITH ORDINALITY` cannot be combined with an inline column
-- definition list on a set-returning function call — Postgres only allows that
-- combination via `ROWS FROM(...)`. Because PL/pgSQL doesn't validate embedded SQL
-- until first execution, this shipped silently and only errored ("WITH ORDINALITY
-- cannot be used with a column definition list") the first time the function
-- actually ran against the live database.

CREATE OR REPLACE FUNCTION public.gifvtme_create_occasion_with_wishlist(
  p_user_id uuid,
  p_title text,
  p_occasion_type text,
  p_occasion_date date,
  p_pulled_items jsonb DEFAULT '[]'::jsonb,
  p_exclusive_items jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(occasion_id uuid, wishlist_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  created_occasion_id uuid;
  created_wishlist_id uuid;
  pulled_count integer := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot create an occasion for another user.';
  END IF;

  INSERT INTO public.occasions (
    user_id,
    title,
    occasion_type,
    occasion_date,
    status
  )
  VALUES (
    p_user_id,
    p_title,
    p_occasion_type,
    p_occasion_date,
    'active'
  )
  RETURNING id INTO created_occasion_id;

  INSERT INTO public.wishlists (
    user_id,
    title,
    type,
    occasion_id,
    visibility,
    prices_visible
  )
  VALUES (
    p_user_id,
    p_title,
    'occasion',
    created_occasion_id,
    'private',
    true
  )
  RETURNING id INTO created_wishlist_id;

  WITH pulled_input AS (
    SELECT DISTINCT ON (item.master_item_id)
      item.master_item_id,
      item.affiliate_url,
      item.ordinality
    FROM ROWS FROM (
      jsonb_to_recordset(COALESCE(p_pulled_items, '[]'::jsonb))
        AS (master_item_id uuid, affiliate_url text)
    ) WITH ORDINALITY AS item(master_item_id, affiliate_url, ordinality)
    WHERE item.master_item_id IS NOT NULL
    ORDER BY item.master_item_id, item.ordinality
  ),
  pulled_items AS (
    SELECT
      master.id,
      master.origin,
      master.title,
      master.image_url,
      master.product_url,
      pulled_input.affiliate_url,
      master.price,
      master.catalog_product_id,
      row_number() OVER (ORDER BY pulled_input.ordinality) - 1 AS sort_order
    FROM pulled_input
    JOIN public.master_items master ON master.id = pulled_input.master_item_id
    WHERE master.user_id = p_user_id
      AND master.status IS DISTINCT FROM 'purchased'
      AND master.status IS DISTINCT FROM 'archived'
  )
  INSERT INTO public.wishlist_items (
    wishlist_id,
    master_item_id,
    is_exclusive,
    origin,
    title,
    image_url,
    product_url,
    affiliate_url,
    price,
    catalog_product_id,
    status,
    sort_order
  )
  SELECT
    created_wishlist_id,
    pulled_items.id,
    false,
    pulled_items.origin,
    pulled_items.title,
    pulled_items.image_url,
    pulled_items.product_url,
    CASE
      WHEN pulled_items.origin::text = 'external' THEN pulled_items.affiliate_url
      ELSE NULL
    END,
    pulled_items.price,
    pulled_items.catalog_product_id,
    'available',
    pulled_items.sort_order
  FROM pulled_items;

  GET DIAGNOSTICS pulled_count = ROW_COUNT;

  WITH exclusive_items AS (
    SELECT
      item.title,
      item.image_url,
      item.product_url,
      item.affiliate_url,
      item.price,
      item.description,
      item.ordinality
    FROM ROWS FROM (
      jsonb_to_recordset(COALESCE(p_exclusive_items, '[]'::jsonb))
        AS (
          title text,
          image_url text,
          product_url text,
          affiliate_url text,
          price numeric,
          description text
        )
    ) WITH ORDINALITY AS item(
        title, image_url, product_url, affiliate_url, price, description, ordinality
      )
    WHERE item.title IS NOT NULL
      AND item.product_url IS NOT NULL
  )
  INSERT INTO public.wishlist_items (
    wishlist_id,
    master_item_id,
    is_exclusive,
    origin,
    title,
    image_url,
    product_url,
    affiliate_url,
    price,
    description,
    status,
    sort_order
  )
  SELECT
    created_wishlist_id,
    NULL,
    true,
    'external',
    exclusive_items.title,
    exclusive_items.image_url,
    exclusive_items.product_url,
    exclusive_items.affiliate_url,
    exclusive_items.price,
    exclusive_items.description,
    'available',
    pulled_count + exclusive_items.ordinality - 1
  FROM exclusive_items;

  RETURN QUERY SELECT created_occasion_id, created_wishlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_create_occasion_with_wishlist(
  uuid,
  text,
  text,
  date,
  jsonb,
  jsonb
) TO authenticated;
