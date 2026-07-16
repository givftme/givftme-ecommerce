-- Migration 004: Repair customer-facing wishlist RLS policies.
--
-- This migration removes older wishlist policies that can force normal
-- authenticated reads through the protected users table, then recreates the
-- owner/viewer rules with small SECURITY DEFINER helpers. The app still uses
-- the regular Supabase client; these helpers only return booleans for RLS.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS default_thank_you_msg text;

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT SELECT (id, full_name, default_thank_you_msg) ON public.users TO authenticated;
GRANT UPDATE (full_name, default_thank_you_msg) ON public.users TO authenticated;

GRANT SELECT ON public.wishlists TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;

GRANT SELECT ON public.wishlist_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_items TO authenticated;

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.gifvtme_is_wishlist_owner(target_wishlist_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wishlists
    WHERE id = target_wishlist_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_can_read_wishlist(
  target_wishlist_id uuid,
  target_user_id uuid,
  target_visibility text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    target_user_id = auth.uid()
    OR target_visibility = 'public'
    OR (
      target_visibility = 'friends_family'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.wishlist_invites invite
        WHERE invite.wishlist_id = target_wishlist_id
          AND (
            invite.invitee_user_id = auth.uid()
            OR (
              invite.invitee_email IS NOT NULL
              AND auth.jwt() ->> 'email' IS NOT NULL
              AND lower(invite.invitee_email) = lower(auth.jwt() ->> 'email')
            )
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_can_read_wishlist_by_id(
  target_wishlist_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wishlists
    WHERE id = target_wishlist_id
      AND public.gifvtme_can_read_wishlist(id, user_id, visibility::text)
  );
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_can_read_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.purchases purchase
      JOIN public.wishlist_items item
        ON item.id = purchase.wishlist_item_id
      JOIN public.wishlists wishlist
        ON wishlist.id = item.wishlist_id
      WHERE purchase.buyer_id = target_user_id
        AND wishlist.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders gift_order
      JOIN public.wishlist_items item
        ON item.id = gift_order.wishlist_item_id
      JOIN public.wishlists wishlist
        ON wishlist.id = item.wishlist_id
      WHERE gift_order.buyer_id = target_user_id
        AND wishlist.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_is_wishlist_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_can_read_wishlist(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_can_read_wishlist_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_can_read_profile(uuid) TO authenticated;

DROP VIEW IF EXISTS public.wishlist_items_with_status;

CREATE VIEW public.wishlist_items_with_status AS
SELECT
  item.id,
  item.wishlist_id,
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

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'wishlists', 'wishlist_items', 'master_items')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

CREATE POLICY "gifvtme_users_select_allowed_profiles"
ON public.users
FOR SELECT
TO authenticated
USING (public.gifvtme_can_read_profile(id));

CREATE POLICY "gifvtme_users_owner_update"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "gifvtme_wishlists_select_viewable"
ON public.wishlists
FOR SELECT
TO anon, authenticated
USING (public.gifvtme_can_read_wishlist(id, user_id, visibility::text));

CREATE POLICY "gifvtme_wishlists_owner_insert"
ON public.wishlists
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_wishlists_owner_update"
ON public.wishlists
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_wishlists_owner_delete"
ON public.wishlists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "gifvtme_wishlist_items_select_viewable"
ON public.wishlist_items
FOR SELECT
TO anon, authenticated
USING (public.gifvtme_can_read_wishlist_by_id(wishlist_id));

CREATE POLICY "gifvtme_wishlist_items_owner_insert"
ON public.wishlist_items
FOR INSERT
TO authenticated
WITH CHECK (public.gifvtme_is_wishlist_owner(wishlist_id));

CREATE POLICY "gifvtme_wishlist_items_owner_update"
ON public.wishlist_items
FOR UPDATE
TO authenticated
USING (public.gifvtme_is_wishlist_owner(wishlist_id))
WITH CHECK (public.gifvtme_is_wishlist_owner(wishlist_id));

CREATE POLICY "gifvtme_wishlist_items_owner_delete"
ON public.wishlist_items
FOR DELETE
TO authenticated
USING (public.gifvtme_is_wishlist_owner(wishlist_id));

CREATE POLICY "gifvtme_master_items_owner_select"
ON public.master_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "gifvtme_master_items_owner_insert"
ON public.master_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_master_items_owner_update"
ON public.master_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_master_items_owner_delete"
ON public.master_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
