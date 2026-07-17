-- Migration 005: Link occasion wishlist items back to evergreen master_items.

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS master_item_id uuid REFERENCES public.master_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DROP INDEX IF EXISTS public.wishlist_items_master_item_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_wishlist_master_item_unique_idx
  ON public.wishlist_items (wishlist_id, master_item_id)
  WHERE master_item_id IS NOT NULL;

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS occasion_id uuid REFERENCES public.occasions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS reminders_occasion_owner_unsent_idx
  ON public.reminders (user_id, reminder_type, occasion_id, sent);

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'reminders'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%important_date_id%'
      AND pg_get_constraintdef(con.oid) LIKE '%invite_id%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_exactly_one_source_check
  CHECK (num_nonnulls(important_date_id, invite_id, occasion_id) = 1)
  NOT VALID;

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
    FROM jsonb_to_recordset(COALESCE(p_pulled_items, '[]'::jsonb))
      WITH ORDINALITY AS item(
        master_item_id uuid,
        affiliate_url text,
        ordinality bigint
      )
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
    FROM jsonb_to_recordset(COALESCE(p_exclusive_items, '[]'::jsonb))
      WITH ORDINALITY AS item(
        title text,
        image_url text,
        product_url text,
        affiliate_url text,
        price numeric,
        description text,
        ordinality bigint
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

CREATE OR REPLACE FUNCTION public.gifvtme_update_occasion_with_wishlist(
  p_user_id uuid,
  p_occasion_id uuid,
  p_title text DEFAULT NULL,
  p_occasion_type text DEFAULT NULL,
  p_occasion_date date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  occasion_type text,
  occasion_date date,
  status text,
  archived_at timestamptz
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  updated_occasion record;
  wishlist_update_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot update an occasion for another user.';
  END IF;

  UPDATE public.occasions AS occasion
  SET
    title = COALESCE(p_title, occasion.title),
    occasion_type = COALESCE(p_occasion_type, occasion.occasion_type),
    occasion_date = COALESCE(p_occasion_date, occasion.occasion_date)
  WHERE occasion.id = p_occasion_id
    AND occasion.user_id = p_user_id
    AND occasion.status::text <> 'archived'
  RETURNING
    occasion.id,
    occasion.title,
    occasion.occasion_type::text AS occasion_type,
    occasion.occasion_date,
    occasion.status::text AS status,
    occasion.archived_at
  INTO updated_occasion;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not update occasion.';
  END IF;

  IF p_title IS NOT NULL THEN
    UPDATE public.wishlists AS wishlist
    SET title = p_title
    WHERE wishlist.user_id = p_user_id
      AND wishlist.occasion_id = p_occasion_id
      AND wishlist.type::text = 'occasion';

    GET DIAGNOSTICS wishlist_update_count = ROW_COUNT;

    IF wishlist_update_count <> 1 THEN
      RAISE EXCEPTION 'Could not update linked occasion wishlist.';
    END IF;
  END IF;

  RETURN QUERY SELECT
    updated_occasion.id::uuid,
    updated_occasion.title::text,
    updated_occasion.occasion_type::text,
    updated_occasion.occasion_date::date,
    updated_occasion.status::text,
    updated_occasion.archived_at::timestamptz;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_update_occasion_with_wishlist(
  uuid,
  uuid,
  text,
  text,
  date
) TO authenticated;

DROP VIEW IF EXISTS public.wishlist_items_with_status;

CREATE VIEW public.wishlist_items_with_status AS
SELECT
  item.id,
  item.wishlist_id,
  item.master_item_id,
  item.title,
  item.image_url,
  item.product_url,
  item.affiliate_url,
  item.price,
  item.description,
  item.origin,
  item.catalog_product_id,
  CASE
    WHEN item.status::text = 'archived' THEN 'archived'
    WHEN purchase.id IS NOT NULL OR gift_order.id IS NOT NULL THEN 'purchased'
    ELSE item.status::text
  END AS status,
  item.is_exclusive,
  item.sort_order,
  item.created_at,
  purchase.created_at AS affiliate_purchased_at,
  gift_order.status AS order_status
FROM public.wishlist_items item
LEFT JOIN LATERAL (
  SELECT
    purchase_record.id,
    purchase_record.created_at
  FROM public.purchases purchase_record
  WHERE purchase_record.wishlist_item_id = item.id
  LIMIT 1
) purchase ON true
LEFT JOIN LATERAL (
  SELECT
    order_record.id,
    order_record.status
  FROM public.orders order_record
  WHERE order_record.wishlist_item_id = item.id
    AND order_record.status::text NOT IN (
      'pending_payment',
      'payment_failed',
      'cancelled'
    )
  LIMIT 1
) gift_order ON true
WHERE public.gifvtme_can_read_wishlist_by_id(item.wishlist_id);

GRANT SELECT ON public.wishlist_items_with_status TO anon, authenticated;
