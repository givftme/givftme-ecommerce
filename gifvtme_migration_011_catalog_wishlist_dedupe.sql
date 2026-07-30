-- Migration 011: Enforce catalog wishlist item de-duplication at the DB level.
-- The POST /api/wishlists/[id]/items route already checks for an existing
-- (wishlist_id, catalog_product_id) row before inserting, but that check is
-- not atomic — two concurrent requests (double-click, two tabs) can both
-- pass the check before either insert lands, creating duplicate rows. This
-- index makes the DB the source of truth; the route catches the resulting
-- 23505 and returns the same 409 "Already on this wishlist." response.
-- Archived rows are excluded so removing an item and re-adding it later
-- is unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_live_catalog_unique
  ON public.wishlist_items (wishlist_id, catalog_product_id)
  WHERE origin = 'catalog'
    AND catalog_product_id IS NOT NULL
    AND status <> 'archived';
