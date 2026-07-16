-- Migration 003: Add sort_order to wishlist_items and master_items

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.master_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_sort_order_idx
  ON public.wishlist_items (wishlist_id, sort_order);

CREATE INDEX IF NOT EXISTS master_items_user_id_sort_order_idx
  ON public.master_items (user_id, sort_order);
