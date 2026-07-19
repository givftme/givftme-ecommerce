-- Migration 006: Sharing and giver flow support.
--
-- Adds intent flags, invite reminders access helpers, and a narrow shared
-- wishlist resolver so invite-token URLs can be viewed without opening broad
-- table access to anonymous users.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS intent_flagged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intent_flagged_at timestamptz;

CREATE INDEX IF NOT EXISTS wishlist_items_intent_flagged_at_idx
  ON public.wishlist_items (intent_flagged_at)
  WHERE intent_flagged_at IS NOT NULL;

ALTER TABLE public.wishlist_invites
  ADD COLUMN IF NOT EXISTS inviter_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invitee_email text,
  ADD COLUMN IF NOT EXISTS invitee_phone text,
  ADD COLUMN IF NOT EXISTS invitee_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS token text DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS reminder_opted_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.wishlist_invites
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(16), 'hex');

UPDATE public.wishlist_invites
SET token = encode(gen_random_bytes(16), 'hex')
WHERE token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_invites_token_unique_idx
  ON public.wishlist_invites (token);

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_invites_email_unique_idx
  ON public.wishlist_invites (wishlist_id, lower(invitee_email))
  WHERE invitee_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_invites_phone_unique_idx
  ON public.wishlist_invites (wishlist_id, invitee_phone)
  WHERE invitee_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_invites_user_unique_idx
  ON public.wishlist_invites (wishlist_id, invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;

GRANT SELECT (id, full_name, avatar_url, default_thank_you_msg)
  ON public.users TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.wishlist_invites TO authenticated;

GRANT SELECT ON public.wishlist_invites TO anon;

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
  item.intent_flagged_by,
  item.intent_flagged_at,
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

DROP POLICY IF EXISTS gifvtme_wishlist_invites_owner_select
  ON public.wishlist_invites;
DROP POLICY IF EXISTS gifvtme_wishlist_invites_invitee_select
  ON public.wishlist_invites;
DROP POLICY IF EXISTS gifvtme_wishlist_invites_owner_insert
  ON public.wishlist_invites;
DROP POLICY IF EXISTS gifvtme_wishlist_invites_public_self_insert
  ON public.wishlist_invites;
DROP POLICY IF EXISTS gifvtme_wishlist_invites_owner_delete
  ON public.wishlist_invites;

ALTER TABLE public.wishlist_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY gifvtme_wishlist_invites_owner_select
ON public.wishlist_invites
FOR SELECT
TO authenticated
USING (public.gifvtme_is_wishlist_owner(wishlist_id));

CREATE POLICY gifvtme_wishlist_invites_invitee_select
ON public.wishlist_invites
FOR SELECT
TO authenticated
USING (
  invitee_user_id = auth.uid()
  OR (
    invitee_email IS NOT NULL
    AND auth.jwt() ->> 'email' IS NOT NULL
    AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE POLICY gifvtme_wishlist_invites_owner_insert
ON public.wishlist_invites
FOR INSERT
TO authenticated
WITH CHECK (
  inviter_user_id = auth.uid()
  AND public.gifvtme_is_wishlist_owner(wishlist_id)
);

CREATE POLICY gifvtme_wishlist_invites_public_self_insert
ON public.wishlist_invites
FOR INSERT
TO authenticated
WITH CHECK (
  invitee_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.wishlists wishlist
    WHERE wishlist.id = wishlist_id
      AND wishlist.visibility::text = 'public'
      AND wishlist.user_id = inviter_user_id
  )
);

CREATE POLICY gifvtme_wishlist_invites_owner_delete
ON public.wishlist_invites
FOR DELETE
TO authenticated
USING (public.gifvtme_is_wishlist_owner(wishlist_id));

CREATE OR REPLACE FUNCTION public.gifvtme_get_shared_wishlist(p_share_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  invite_record record;
  wishlist_record record;
  item_list jsonb;
BEGIN
  IF p_share_key IS NULL OR length(trim(p_share_key)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT
    invite.id,
    invite.wishlist_id,
    invite.inviter_user_id,
    invite.invitee_email,
    invite.invitee_phone,
    invite.invitee_user_id,
    invite.token,
    invite.reminder_opted_in,
    invite.accepted_at,
    invite.created_at
  INTO invite_record
  FROM public.wishlist_invites invite
  WHERE invite.token = p_share_key
  LIMIT 1;

  IF FOUND THEN
    SELECT
      wishlist.id,
      wishlist.title,
      wishlist.visibility::text AS visibility,
      wishlist.prices_visible,
      wishlist.user_id,
      wishlist.occasion_id,
      owner.full_name,
      owner.avatar_url,
      occasion.title AS occasion_title,
      occasion.occasion_type::text AS occasion_type,
      occasion.occasion_date
    INTO wishlist_record
    FROM public.wishlists wishlist
    JOIN public.users owner ON owner.id = wishlist.user_id
    LEFT JOIN public.occasions occasion ON occasion.id = wishlist.occasion_id
    WHERE wishlist.id = invite_record.wishlist_id
      AND wishlist.visibility::text <> 'private';
  ELSE
    IF p_share_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN NULL;
    END IF;

    SELECT
      wishlist.id,
      wishlist.title,
      wishlist.visibility::text AS visibility,
      wishlist.prices_visible,
      wishlist.user_id,
      wishlist.occasion_id,
      owner.full_name,
      owner.avatar_url,
      occasion.title AS occasion_title,
      occasion.occasion_type::text AS occasion_type,
      occasion.occasion_date
    INTO wishlist_record
    FROM public.wishlists wishlist
    JOIN public.users owner ON owner.id = wishlist.user_id
    LEFT JOIN public.occasions occasion ON occasion.id = wishlist.occasion_id
    WHERE wishlist.id = p_share_key::uuid
      AND (
        wishlist.visibility::text = 'public'
        OR wishlist.user_id = auth.uid()
      );
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'wishlist_id', item.wishlist_id,
        'master_item_id', item.master_item_id,
        'title', item.title,
        'image_url', item.image_url,
        'product_url', item.product_url,
        'affiliate_url', item.affiliate_url,
        'price', item.price,
        'description', item.description,
        'origin', item.origin::text,
        'catalog_product_id', item.catalog_product_id,
        'status',
          CASE
            WHEN purchase.id IS NOT NULL OR gift_order.id IS NOT NULL THEN 'purchased'
            ELSE item.status::text
          END,
        'is_exclusive', item.is_exclusive,
        'sort_order', item.sort_order,
        'created_at', item.created_at,
        'intent_flagged_by', item.intent_flagged_by,
        'intent_flagged_at', item.intent_flagged_at,
        'affiliate_purchased_at', purchase.created_at,
        'order_status', gift_order.status
      )
      ORDER BY item.sort_order, item.created_at
    ),
    '[]'::jsonb
  )
  INTO item_list
  FROM public.wishlist_items item
  LEFT JOIN LATERAL (
    SELECT purchase_record.id, purchase_record.created_at
    FROM public.purchases purchase_record
    WHERE purchase_record.wishlist_item_id = item.id
    LIMIT 1
  ) purchase ON true
  LEFT JOIN LATERAL (
    SELECT order_record.id, order_record.status
    FROM public.orders order_record
    WHERE order_record.wishlist_item_id = item.id
      AND order_record.status::text NOT IN (
        'pending_payment',
        'payment_failed',
        'cancelled'
      )
    LIMIT 1
  ) gift_order ON true
  WHERE item.wishlist_id = wishlist_record.id
    AND item.status::text <> 'archived';

  RETURN jsonb_build_object(
    'invite',
      CASE
        WHEN invite_record.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', invite_record.id,
          'wishlist_id', invite_record.wishlist_id,
          'inviter_user_id', invite_record.inviter_user_id,
          'invitee_email', invite_record.invitee_email,
          'invitee_phone', invite_record.invitee_phone,
          'invitee_user_id', invite_record.invitee_user_id,
          'token', invite_record.token,
          'reminder_opted_in', invite_record.reminder_opted_in,
          'accepted_at', invite_record.accepted_at,
          'created_at', invite_record.created_at
        )
      END,
    'wishlist',
      jsonb_build_object(
        'id', wishlist_record.id,
        'title', wishlist_record.title,
        'visibility', wishlist_record.visibility,
        'prices_visible', wishlist_record.prices_visible,
        'owner', jsonb_build_object(
          'id', wishlist_record.user_id,
          'full_name', wishlist_record.full_name,
          'avatar_url', wishlist_record.avatar_url
        ),
        'occasion',
          CASE
            WHEN wishlist_record.occasion_id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', wishlist_record.occasion_id,
              'title', wishlist_record.occasion_title,
              'occasion_type', wishlist_record.occasion_type,
              'occasion_date', wishlist_record.occasion_date
            )
          END,
        'items', item_list
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_accept_wishlist_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.wishlist_invites invite
  SET
    invitee_user_id = auth.uid(),
    accepted_at = COALESCE(invite.accepted_at, now())
  WHERE invite.id = p_invite_id
    AND invite.invitee_user_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_flag_wishlist_item_intent(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_item record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT item.id, item.wishlist_id, item.status::text AS status, item.intent_flagged_by
  INTO target_item
  FROM public.wishlist_items item
  WHERE item.id = p_item_id;

  IF NOT FOUND OR target_item.status <> 'available' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  IF NOT public.gifvtme_can_read_wishlist_by_id(target_item.wishlist_id) THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  IF target_item.intent_flagged_by IS NOT NULL THEN
    RAISE EXCEPTION 'already_flagged';
  END IF;

  UPDATE public.wishlist_items
  SET
    intent_flagged_by = auth.uid(),
    intent_flagged_at = now()
  WHERE id = p_item_id
    AND status::text = 'available'
    AND intent_flagged_by IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_clear_wishlist_item_intent(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.wishlist_items
  SET
    intent_flagged_by = NULL,
    intent_flagged_at = NULL
  WHERE id = p_item_id
    AND intent_flagged_by = auth.uid()
    AND status::text = 'available';
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_opt_in_wishlist_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_wishlist_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.wishlist_invites invite
  SET
    invitee_user_id = COALESCE(invite.invitee_user_id, auth.uid()),
    reminder_opted_in = true,
    accepted_at = COALESCE(invite.accepted_at, now())
  WHERE invite.id = p_invite_id
    AND (
      invite.invitee_user_id = auth.uid()
      OR invite.invitee_user_id IS NULL
      OR (
        invite.invitee_email IS NOT NULL
        AND auth.jwt() ->> 'email' IS NOT NULL
        AND lower(invite.invitee_email) = lower(auth.jwt() ->> 'email')
      )
    )
  RETURNING invite.wishlist_id INTO target_wishlist_id;

  IF target_wishlist_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  RETURN target_wishlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_get_shared_wishlist(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_accept_wishlist_invite(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_flag_wishlist_item_intent(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_clear_wishlist_item_intent(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_opt_in_wishlist_invite(uuid)
  TO authenticated;
