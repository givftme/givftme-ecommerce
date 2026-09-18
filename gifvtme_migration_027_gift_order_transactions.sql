-- Migration 027: purchase intent functions, and the transactional gift
-- order RPCs. Spec 0002, build plan steps 3, 4, 9, 10, 12 and 13. Ships in
-- the same release as migration 026.
--
-- The headline fix is in gifvtme_confirm_gift_order. Today the Flutterwave
-- webhook confirms a paid order with four sequential Supabase REST calls:
-- update the order, update the wishlist item, read the master item, update
-- the master item. Each failure is a console.error and nothing else, so a
-- crash or a network blip between them leaves a paid order with an item
-- still showing as available, and there is no path that repairs it. Moving
-- the whole sequence into one plpgsql function makes it one Postgres
-- transaction — the same pattern migration 018 used for order creation.
--
-- The second fix is quieter but matters as much: nothing a browser can
-- reach may set a claim to 'purchased'. Only this function does, only
-- inside the transaction that confirms the order, and only when the claim
-- is still checking out for that same order. When it is not — a bank
-- transfer that settled after the hold lapsed and somebody else reserved
-- the item — the order is still confirmed, because the money was taken,
-- and it is flagged claim_conflict for a human rather than silently
-- stealing the new claimant's reservation (spec AC-34).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Purchase intents (build plan steps 3 and 4)
-- ---------------------------------------------------------------------

-- The one thing a signed out visitor may do. SECURITY DEFINER because
-- gift_purchase_intents has no client policy at all; readability of the
-- wishlist is still checked with the same helper the public page uses, so
-- this cannot be used to record an intent against a list the caller
-- cannot see.
CREATE OR REPLACE FUNCTION public.gifvtme_create_purchase_intent(
  p_reference_hash text,
  p_item_id uuid,
  p_combination_key text DEFAULT NULL,
  p_selected_options jsonb DEFAULT NULL,
  p_intended_action text DEFAULT 'buy',
  p_ttl_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_item record;
  created record;
BEGIN
  IF p_intended_action NOT IN ('reserve', 'buy') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT item.id, item.wishlist_id, item.status::text AS status,
         item.origin::text AS origin, item.catalog_product_id
  INTO target_item
  FROM public.wishlist_items item
  WHERE item.id = p_item_id;

  IF NOT FOUND OR NOT public.gifvtme_can_read_wishlist_by_id(target_item.wishlist_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF target_item.origin <> 'catalog' OR target_item.catalog_product_id IS NULL THEN
    RAISE EXCEPTION 'external_origin';
  END IF;

  IF target_item.status = 'purchased' THEN
    RAISE EXCEPTION 'already_purchased';
  END IF;

  -- Deliberately NOT refused when the item is already reserved by someone
  -- else. An intent blocks nothing and costs nothing, and the visitor may
  -- well finish signing up after that reservation lapses. Availability is
  -- decided at resume, not here (spec AC-12).

  INSERT INTO public.gift_purchase_intents (
    reference_hash,
    wishlist_id,
    wishlist_item_id,
    catalog_product_id,
    combination_key,
    selected_options,
    intended_action,
    expires_at
  )
  VALUES (
    p_reference_hash,
    target_item.wishlist_id,
    p_item_id,
    target_item.catalog_product_id,
    p_combination_key,
    p_selected_options,
    p_intended_action,
    now() + make_interval(hours => p_ttl_hours)
  )
  RETURNING id, expires_at INTO created;

  RETURN jsonb_build_object(
    'intent_id', created.id,
    'expires_at', created.expires_at
  );
END;
$$;

-- Step one of resume: work out what this reference means and, if it is
-- usable, bind it to the account that just authenticated. Binding is
-- first-come and permanent. An intent bound to one account is never
-- silently handed to another (spec AC-10).
CREATE OR REPLACE FUNCTION public.gifvtme_resolve_purchase_intent(
  p_reference_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  intent record;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO intent
  FROM public.gift_purchase_intents
  WHERE reference_hash = p_reference_hash
  FOR UPDATE;

  -- An unknown reference and a real one look identical from outside, so a
  -- guessed value learns nothing.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF intent.status = 'consumed' THEN
    RETURN jsonb_build_object(
      'outcome', 'consumed',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id,
      'intended_action', intent.intended_action,
      'combination_key', intent.combination_key,
      'claim_id', intent.resulting_claim_id
    );
  END IF;

  IF intent.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'outcome', 'cancelled',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id
    );
  END IF;

  IF intent.status = 'expired' OR intent.expires_at <= now() THEN
    UPDATE public.gift_purchase_intents
    SET status = 'expired'
    WHERE id = intent.id
      AND status = 'pending';

    RETURN jsonb_build_object(
      'outcome', 'expired',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id
    );
  END IF;

  IF intent.bound_user_id IS NOT NULL AND intent.bound_user_id <> acting_user THEN
    -- No transition of any kind. Not consumed, not cancelled, not
    -- reassigned. The first account keeps it.
    RETURN jsonb_build_object(
      'outcome', 'account_mismatch',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id
    );
  END IF;

  IF intent.bound_user_id IS NULL THEN
    UPDATE public.gift_purchase_intents
    SET bound_user_id = acting_user,
        bound_at = now()
    WHERE id = intent.id;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ready',
    'intent_id', intent.id,
    'wishlist_id', intent.wishlist_id,
    'wishlist_item_id', intent.wishlist_item_id,
    'catalog_product_id', intent.catalog_product_id,
    'combination_key', intent.combination_key,
    'selected_options', intent.selected_options,
    'intended_action', intent.intended_action
  );
END;
$$;

-- Step two of resume, after the route handler has re-resolved the product
-- and its price from Sanity. Creating the claim and consuming the intent
-- happen here together, in one transaction, which is what makes a double
-- submit or a refreshed tab resolve to the same claim instead of making a
-- second one (spec AC-11, invariant 4).
CREATE OR REPLACE FUNCTION public.gifvtme_consume_purchase_intent(
  p_reference_hash text,
  p_reservation_hours integer DEFAULT 72,
  p_max_active_claims integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  intent record;
  claim_result jsonb;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO intent
  FROM public.gift_purchase_intents
  WHERE reference_hash = p_reference_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF intent.status = 'consumed' THEN
    RETURN jsonb_build_object(
      'outcome', 'claimed',
      'claim_id', intent.resulting_claim_id,
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id,
      'intended_action', intent.intended_action,
      'combination_key', intent.combination_key,
      'replayed', true
    );
  END IF;

  IF intent.status <> 'pending' OR intent.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'outcome', 'expired',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id
    );
  END IF;

  IF intent.bound_user_id IS NOT NULL AND intent.bound_user_id <> acting_user THEN
    RETURN jsonb_build_object(
      'outcome', 'account_mismatch',
      'wishlist_id', intent.wishlist_id,
      'wishlist_item_id', intent.wishlist_item_id
    );
  END IF;

  BEGIN
    claim_result := public.gifvtme_claim_wishlist_item(
      intent.wishlist_item_id,
      p_reservation_hours,
      p_max_active_claims
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- The item moved while the visitor was signing up. Cancel the
      -- intent so it cannot be retried into existence, and let the page
      -- tell them what happened.
      UPDATE public.gift_purchase_intents
      SET status = 'cancelled'
      WHERE id = intent.id;

      RETURN jsonb_build_object(
        'outcome', CASE
          WHEN SQLERRM LIKE '%already_purchased%' THEN 'already_purchased'
          WHEN SQLERRM LIKE '%already_reserved%' THEN 'already_reserved'
          WHEN SQLERRM LIKE '%too_many_claims%' THEN 'too_many_claims'
          WHEN SQLERRM LIKE '%external_origin%' THEN 'external_origin'
          ELSE 'not_available'
        END,
        'wishlist_id', intent.wishlist_id,
        'wishlist_item_id', intent.wishlist_item_id
      );
  END;

  UPDATE public.gift_purchase_intents
  SET status = 'consumed',
      consumed_at = now(),
      resulting_claim_id = (claim_result->>'claim_id')::uuid,
      bound_user_id = COALESCE(bound_user_id, acting_user),
      bound_at = COALESCE(bound_at, now())
  WHERE id = intent.id;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'claim_id', (claim_result->>'claim_id')::uuid,
    'state', claim_result->>'state',
    'expires_at', claim_result->>'expires_at',
    'wishlist_id', intent.wishlist_id,
    'wishlist_item_id', intent.wishlist_item_id,
    'intended_action', intent.intended_action,
    'combination_key', intent.combination_key,
    'replayed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_create_purchase_intent(
  text, uuid, text, jsonb, text, integer
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_resolve_purchase_intent(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_consume_purchase_intent(text, integer, integer)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Entering gift checkout (build plan step 10)
-- ---------------------------------------------------------------------

-- Moves the caller's own reserved claim into checking_out for a 60 minute
-- hold. Reopening checkout does not extend an existing hold, and the
-- underlying 72h reservation deadline is untouched either way.
CREATE OR REPLACE FUNCTION public.gifvtme_begin_gift_checkout(
  p_item_id uuid,
  p_hold_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  claim record;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO claim
  FROM public.wishlist_gift_claims
  WHERE wishlist_item_id = p_item_id
    AND claimant_user_id = acting_user
    AND state IN ('reserved', 'checking_out')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'no_active_claim');
  END IF;

  IF claim.expires_at <= now() THEN
    UPDATE public.wishlist_gift_claims
    SET state = 'expired',
        released_at = now(),
        release_reason = 'expired',
        updated_at = now()
    WHERE id = claim.id;

    RETURN jsonb_build_object('outcome', 'expired');
  END IF;

  IF claim.state = 'checking_out' THEN
    -- Already holding. Hand back the existing deadline rather than
    -- granting another hour for reloading the page.
    RETURN jsonb_build_object(
      'outcome', 'ok',
      'claim_id', claim.id,
      'wishlist_id', claim.wishlist_id,
      'state', claim.state,
      'expires_at', claim.expires_at
    );
  END IF;

  UPDATE public.wishlist_gift_claims
  SET state = 'checking_out',
      checkout_started_at = now(),
      expires_at = LEAST(
        claim.reserved_expires_at,
        now() + make_interval(mins => p_hold_minutes)
      ),
      updated_at = now()
  WHERE id = claim.id
  RETURNING * INTO claim;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'claim_id', claim.id,
    'wishlist_id', claim.wishlist_id,
    'state', claim.state,
    'expires_at', claim.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_begin_gift_checkout(uuid, integer)
  TO authenticated;

-- POST /api/checkout no longer accepts a wishlist_item_id from the client,
-- so it needs some way to know which wishlist item this gift order is for.
-- The answer is the caller's own live claim for the catalogue product in
-- their cart. A buyer can only ever reach an item they actually reserved,
-- which is precisely what the old localStorage association could not
-- guarantee (spec AC-38).
CREATE OR REPLACE FUNCTION public.gifvtme_get_active_claim_for_product(
  p_catalog_product_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  acting_user uuid := auth.uid();
  found_claim record;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT claim.id, claim.wishlist_id, claim.wishlist_item_id, claim.state,
         claim.reserved_at, claim.expires_at
  INTO found_claim
  FROM public.wishlist_gift_claims claim
  JOIN public.wishlist_items item ON item.id = claim.wishlist_item_id
  WHERE claim.claimant_user_id = acting_user
    AND claim.state IN ('reserved', 'checking_out')
    AND claim.expires_at > now()
    AND item.catalog_product_id = p_catalog_product_id
    AND item.origin::text = 'catalog'
  ORDER BY claim.reserved_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'claim_id', found_claim.id,
    'wishlist_id', found_claim.wishlist_id,
    'wishlist_item_id', found_claim.wishlist_item_id,
    'state', found_claim.state,
    'reserved_at', found_claim.reserved_at,
    'expires_at', found_claim.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_get_active_claim_for_product(text)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Order creation, extended for gifts (build plan step 9)
-- ---------------------------------------------------------------------

-- Replaces migration 025's twelve argument version. Dropped rather than
-- overloaded, because two functions differing only by trailing arguments
-- would be ambiguous to PostgREST's named argument resolution. Everything
-- migration 018 and 025 established is kept: the invoker check, the single
-- transaction over orders plus order_items, payment_claimed_at, and the
-- price_changes projection.
DROP FUNCTION IF EXISTS public.gifvtme_create_checkout_order(
  uuid, text, numeric, text, text, text, text, text, text, text, uuid, jsonb
);

CREATE FUNCTION public.gifvtme_create_checkout_order(
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
  p_order_items jsonb,
  p_order_source text DEFAULT 'self',
  p_gift_claim_id uuid DEFAULT NULL,
  p_recipient_wishlist_id uuid DEFAULT NULL,
  p_gift_message text DEFAULT NULL,
  p_surprise_preference text DEFAULT NULL,
  p_delivery_window_start date DEFAULT NULL,
  p_delivery_window_end date DEFAULT NULL,
  p_fulfilment_blocked_reason text DEFAULT NULL,
  p_recipient_destination_snapshot jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  created_order_id uuid;
  claim record;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_buyer_id THEN
    RAISE EXCEPTION 'Cannot create an order for another user.';
  END IF;

  IF jsonb_array_length(p_order_items) < 1 THEN
    RAISE EXCEPTION 'An order needs at least one item.';
  END IF;

  IF p_order_source NOT IN ('self', 'wishlist') THEN
    RAISE EXCEPTION 'invalid_order_source';
  END IF;

  IF p_order_source = 'wishlist' THEN
    -- Invariant 8: a wishlist order always has a claim and a recipient
    -- wishlist, and exactly one line at quantity 1. Checked here as well
    -- as in the route, because this is the boundary that cannot be
    -- bypassed.
    IF p_gift_claim_id IS NULL OR p_recipient_wishlist_id IS NULL THEN
      RAISE EXCEPTION 'gift_order_missing_claim';
    END IF;

    IF jsonb_array_length(p_order_items) <> 1
       OR (p_order_items->0->>'quantity')::integer <> 1 THEN
      RAISE EXCEPTION 'gift_order_shape';
    END IF;

    SELECT * INTO claim
    FROM public.wishlist_gift_claims
    WHERE id = p_gift_claim_id
    FOR UPDATE;

    IF NOT FOUND
       OR claim.claimant_user_id <> p_buyer_id
       OR claim.state <> 'checking_out'
       OR claim.wishlist_item_id IS DISTINCT FROM p_wishlist_item_id
       OR claim.wishlist_id IS DISTINCT FROM p_recipient_wishlist_id THEN
      RAISE EXCEPTION 'gift_claim_not_held';
    END IF;
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
    price_changes,
    order_source,
    gift_claim_id,
    recipient_wishlist_id,
    gift_message,
    surprise_preference,
    delivery_window_start,
    delivery_window_end,
    fulfilment_blocked_reason,
    recipient_destination_snapshot
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
    ), '[]'::jsonb),
    p_order_source,
    p_gift_claim_id,
    p_recipient_wishlist_id,
    p_gift_message,
    p_surprise_preference,
    p_delivery_window_start,
    p_delivery_window_end,
    p_fulfilment_blocked_reason,
    p_recipient_destination_snapshot
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

GRANT EXECUTE ON FUNCTION public.gifvtme_create_checkout_order(
  uuid, text, numeric, text, text, text, text, text, text, text, uuid, jsonb,
  text, uuid, uuid, text, text, date, date, text, jsonb
) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Confirming and failing a gift order (build plan steps 12 and 13)
-- ---------------------------------------------------------------------

-- Everything the webhook used to do in four independent REST calls, in one
-- transaction. Service role only: no browser reachable path reaches this,
-- which is what makes 'purchased' unforgeable (spec AC-19).
--
-- Returns already_confirmed so the caller can tell a first delivery from a
-- Flutterwave retry and send exactly one confirmation email (spec AC-36).
CREATE OR REPLACE FUNCTION public.gifvtme_confirm_gift_order(
  p_order_id uuid,
  p_tx_id text,
  p_tx_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order record;
  claim_rows integer := 0;
  conflict boolean := false;
  target_master_item uuid;
BEGIN
  SELECT * INTO target_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF target_order.status::text = 'confirmed' THEN
    RETURN jsonb_build_object(
      'outcome', 'ok',
      'already_confirmed', true,
      'claim_conflict', target_order.fulfilment_blocked_reason = 'claim_conflict'
    );
  END IF;

  IF target_order.gift_claim_id IS NOT NULL THEN
    -- Conditional on purpose. It matches only while this buyer's claim is
    -- still the one checking out for this item. If the hold lapsed and
    -- somebody else reserved it, this matches nothing and we do not touch
    -- their claim.
    UPDATE public.wishlist_gift_claims
    SET state = 'purchased',
        purchased_at = now(),
        updated_at = now()
    WHERE id = target_order.gift_claim_id
      AND claimant_user_id = target_order.buyer_id
      AND state = 'checking_out';

    GET DIAGNOSTICS claim_rows = ROW_COUNT;
    conflict := claim_rows = 0;
  END IF;

  UPDATE public.orders
  SET status = 'confirmed',
      flutterwave_tx_id = p_tx_id,
      flutterwave_tx_ref = p_tx_ref,
      fulfilment_blocked_reason = CASE
        WHEN conflict THEN 'claim_conflict'
        ELSE fulfilment_blocked_reason
      END
  WHERE id = p_order_id;

  IF target_order.wishlist_item_id IS NOT NULL AND NOT conflict THEN
    UPDATE public.wishlist_items
    SET status = 'purchased'
    WHERE id = target_order.wishlist_item_id;

    SELECT master_item_id INTO target_master_item
    FROM public.wishlist_items
    WHERE id = target_order.wishlist_item_id;

    IF target_master_item IS NOT NULL THEN
      UPDATE public.master_items
      SET status = 'purchased'
      WHERE id = target_master_item;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'already_confirmed', false,
    'claim_conflict', conflict
  );
END;
$$;

-- The mirror image: a failed payment must not leave the claim stuck in
-- checking_out until the sweep notices, because the buyer may want to
-- retry immediately against the same claim and the same order (spec
-- AC-18). The claim goes back to reserved on its ORIGINAL deadline, or
-- straight to expired if that deadline has already passed.
CREATE OR REPLACE FUNCTION public.gifvtme_fail_gift_order(
  p_order_id uuid,
  p_tx_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order record;
BEGIN
  SELECT * INTO target_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF target_order.status::text = 'confirmed' THEN
    -- A late failure notice for an order that already succeeded changes
    -- nothing.
    RETURN jsonb_build_object('outcome', 'already_confirmed');
  END IF;

  UPDATE public.orders
  SET status = 'payment_failed',
      flutterwave_tx_id = p_tx_id
  WHERE id = p_order_id;

  IF target_order.gift_claim_id IS NOT NULL THEN
    UPDATE public.wishlist_gift_claims
    SET state = CASE
          WHEN reserved_expires_at > now() THEN 'reserved'
          ELSE 'expired'
        END,
        expires_at = reserved_expires_at,
        checkout_started_at = NULL,
        released_at = CASE
          WHEN reserved_expires_at > now() THEN NULL
          ELSE now()
        END,
        release_reason = CASE
          WHEN reserved_expires_at > now() THEN NULL
          ELSE 'expired'
        END,
        updated_at = now()
    WHERE id = target_order.gift_claim_id
      AND state = 'checking_out';
  END IF;

  RETURN jsonb_build_object('outcome', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.gifvtme_confirm_gift_order(uuid, text, text)
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_fail_gift_order(uuid, text)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_confirm_gift_order(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.gifvtme_fail_gift_order(uuid, text)
  TO service_role;

COMMIT;
