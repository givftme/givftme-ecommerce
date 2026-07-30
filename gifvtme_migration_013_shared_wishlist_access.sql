-- Migration 013: Distinguish "not found" from "restricted" on the shared
-- wishlist resolver, and expose occasion archived state.
--
-- gifvtme_get_shared_wishlist previously returned NULL for both "no wishlist
-- matches this token/id" and "a wishlist matches but the viewer isn't allowed
-- to see it" (private wishlist, or a friends_family/private wishlist visited
-- by id without a valid invite token). 08-SHARED-WISHLIST-VIEW.md requires
-- these to render different pages ("doesn't exist" vs "exists but private"),
-- so the function now always returns a jsonb object with an `access` field:
-- 'not_found' | 'restricted' | 'ok'. Only 'ok' includes wishlist/item data.
--
-- Also adds occasion.status/archived_at to the returned occasion object so
-- the shared view can show an "this occasion has passed" page once an
-- occasion has been auto-archived (distinct from the occasion date merely
-- being in the past — see edge case 1 in the spec).

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
    RETURN jsonb_build_object('access', 'not_found');
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
      occasion.occasion_date,
      occasion.status::text AS occasion_status
    INTO wishlist_record
    FROM public.wishlists wishlist
    JOIN public.users owner ON owner.id = wishlist.user_id
    LEFT JOIN public.occasions occasion ON occasion.id = wishlist.occasion_id
    WHERE wishlist.id = invite_record.wishlist_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('access', 'not_found');
    END IF;

    IF wishlist_record.visibility = 'private' THEN
      RETURN jsonb_build_object('access', 'restricted');
    END IF;
  ELSE
    IF p_share_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('access', 'not_found');
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
      occasion.occasion_date,
      occasion.status::text AS occasion_status
    INTO wishlist_record
    FROM public.wishlists wishlist
    JOIN public.users owner ON owner.id = wishlist.user_id
    LEFT JOIN public.occasions occasion ON occasion.id = wishlist.occasion_id
    WHERE wishlist.id = p_share_key::uuid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('access', 'not_found');
    END IF;

    IF wishlist_record.visibility <> 'public'
      AND wishlist_record.user_id IS DISTINCT FROM auth.uid() THEN
      RETURN jsonb_build_object('access', 'restricted');
    END IF;
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
    'access', 'ok',
    'invite',
      CASE
        WHEN invite_record.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', invite_record.id,
          'wishlist_id', invite_record.wishlist_id,
          'inviter_user_id', invite_record.inviter_user_id,
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
              'occasion_date', wishlist_record.occasion_date,
              'status', wishlist_record.occasion_status
            )
          END,
        'items', item_list
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_get_shared_wishlist(text)
  TO anon, authenticated;
