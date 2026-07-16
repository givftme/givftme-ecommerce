-- Migration 005: Link occasion wishlist items back to evergreen master_items.

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS master_item_id uuid REFERENCES public.master_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS wishlist_items_master_item_id_idx
  ON public.wishlist_items (master_item_id);

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
  purchase.buyer_id AS affiliate_buyer_id,
  purchase.created_at AS affiliate_purchased_at,
  purchase.id AS purchase_id,
  gift_order.buyer_id AS order_buyer_id,
  gift_order.id AS order_id,
  gift_order.status AS order_status
FROM public.wishlist_items item
LEFT JOIN LATERAL (
  SELECT
    purchase_record.id,
    purchase_record.buyer_id,
    purchase_record.created_at
  FROM public.purchases purchase_record
  WHERE purchase_record.wishlist_item_id = item.id
  LIMIT 1
) purchase ON true
LEFT JOIN LATERAL (
  SELECT
    order_record.id,
    order_record.buyer_id,
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
