-- Migration 026: gift claims, server-held purchase intents, and the
-- additive gift columns on orders. Spec 0002, Migration A (build plan
-- steps 1, 2 and 7).
--
-- Three things change here, and they are deliberately additive. Nothing
-- existing is dropped, no policy is widened, and the old
-- intent_flagged_by / intent_flagged_at path keeps working. Migration 028
-- backfills those flags into claims and switches the readers over; until
-- then both representations coexist on purpose.
--
-- 1. `wishlist_gift_claims` replaces the intent flag with a real record
--    that has states and a clock. The old flag was a pair of columns on
--    wishlist_items with a 24h expiry applied at *read* time in
--    lib/wishlist/shared.ts, so the database itself never knew a flag had
--    lapsed and nothing stopped two people holding one item. Expiry is now
--    authoritative in SQL and "one live claim per item" is a partial
--    unique index rather than application code, because application code
--    cannot win a race against itself.
--
-- 2. `gift_purchase_intents` carries a signed-out visitor's chosen gift
--    across signup. It stores identity and intent only: no price, no
--    product title, no image, no recipient data. There is nothing in a row
--    worth tampering with even if a client could reach one, and no client
--    can — the table has row level security enabled and *no policy at all*,
--    so it is reachable only through the SECURITY DEFINER functions below
--    and through the service role. The raw continuation reference is never
--    stored, only its SHA-256, so a database read cannot resume somebody
--    else's purchase.
--
-- 3. `orders` gains the gift columns. No existing order column changes and
--    no orders policy is touched. Spec AC-32 promises order authorization
--    is unchanged, and the cheapest way to keep that promise is to not go
--    near it.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Claims
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wishlist_gift_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id uuid NOT NULL
    REFERENCES public.wishlist_items (id) ON DELETE CASCADE,
  wishlist_id uuid NOT NULL
    REFERENCES public.wishlists (id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved', 'checking_out', 'purchased', 'released', 'expired')),
  -- reserved_at is the start of the 72h clock and is set once, when the
  -- authenticated reservation is created. It is never back-dated to when
  -- the visitor first clicked, and moving to checking_out and back does
  -- not reset it: a buyer who abandons checkout resumes on the original
  -- clock, not a fresh one (spec AC-16, AC-18).
  reserved_at timestamptz NOT NULL DEFAULT now(),
  -- Two clocks, on purpose. expires_at is the live deadline and changes
  -- with the state: reserved_expires_at while reserved, a 60 minute hold
  -- while checking out. reserved_expires_at is written once and never
  -- moves, so an abandoned or failed checkout restores the *original*
  -- 72h deadline rather than granting a fresh one (spec AC-18).
  expires_at timestamptz NOT NULL,
  reserved_expires_at timestamptz NOT NULL,
  checkout_started_at timestamptz,
  purchased_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The invariant, enforced where it cannot be raced: at most one claim per
-- item in a state that blocks other givers. released and expired claims
-- fall out of the index, so an item becomes claimable again the moment a
-- claim is retired.
CREATE UNIQUE INDEX IF NOT EXISTS gifvtme_wishlist_gift_claims_one_active
  ON public.wishlist_gift_claims (wishlist_item_id)
  WHERE state IN ('reserved', 'checking_out', 'purchased');

-- Drives the sweep in POST /api/claims/sweep.
CREATE INDEX IF NOT EXISTS gifvtme_wishlist_gift_claims_expiry
  ON public.wishlist_gift_claims (expires_at)
  WHERE state IN ('reserved', 'checking_out');

CREATE INDEX IF NOT EXISTS gifvtme_wishlist_gift_claims_claimant
  ON public.wishlist_gift_claims (claimant_user_id)
  WHERE state IN ('reserved', 'checking_out');

ALTER TABLE public.wishlist_gift_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gifvtme_wishlist_gift_claims_own_select
  ON public.wishlist_gift_claims;

-- A claimant can read their own claims. Nobody else can read any claim,
-- and that deliberately includes the wishlist owner: spec AC-21 keeps the
-- surprise, and it is enforced here at the data layer rather than by
-- remembering to leave a join out of a query. Other visitors see only the
-- is_reserved boolean on wishlist_items_with_status, never a claimant id.
CREATE POLICY gifvtme_wishlist_gift_claims_own_select
ON public.wishlist_gift_claims
FOR SELECT
TO authenticated
USING (claimant_user_id = auth.uid());

-- No INSERT, UPDATE or DELETE policy exists. Every write goes through the
-- functions below, which is what lets them hold the state machine.

-- ---------------------------------------------------------------------
-- 2. Purchase intents
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gift_purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the opaque reference, hex encoded. The raw reference lives
  -- only in the visitor's cookie (and, for a cross-device return, in the
  -- redirect target). Storing the hash means a leaked database dump
  -- cannot be used to resume anybody's purchase.
  reference_hash text NOT NULL UNIQUE,
  wishlist_id uuid NOT NULL
    REFERENCES public.wishlists (id) ON DELETE CASCADE,
  wishlist_item_id uuid NOT NULL
    REFERENCES public.wishlist_items (id) ON DELETE CASCADE,
  -- Identity only. Never treated as a product fact on resume: the
  -- product, its availability, its variant and its price are all
  -- re-resolved from Sanity every time (spec AC-7).
  catalog_product_id text NOT NULL,
  combination_key text,
  selected_options jsonb,
  intended_action text NOT NULL
    CHECK (intended_action IN ('reserve', 'buy')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'cancelled')),
  bound_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  bound_at timestamptz,
  consumed_at timestamptz,
  resulting_claim_id uuid
    REFERENCES public.wishlist_gift_claims (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS gifvtme_gift_purchase_intents_sweep
  ON public.gift_purchase_intents (expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS gifvtme_gift_purchase_intents_bound_user
  ON public.gift_purchase_intents (bound_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS gifvtme_gift_purchase_intents_retention
  ON public.gift_purchase_intents (created_at)
  WHERE status <> 'pending';

ALTER TABLE public.gift_purchase_intents ENABLE ROW LEVEL SECURITY;

-- Intentionally no policy of any kind. With row level security enabled and
-- no policy, anon and authenticated can read and write nothing here. A
-- visitor never queries this table; they present a cookie and a route
-- handler calls a function.

REVOKE ALL ON public.gift_purchase_intents FROM anon, authenticated;
REVOKE ALL ON public.wishlist_gift_claims FROM anon;

-- ---------------------------------------------------------------------
-- 3. Additive gift columns on orders
-- ---------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS gift_claim_id uuid
    REFERENCES public.wishlist_gift_claims (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_wishlist_id uuid
    REFERENCES public.wishlists (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_message text,
  ADD COLUMN IF NOT EXISTS surprise_preference text,
  ADD COLUMN IF NOT EXISTS delivery_window_start date,
  ADD COLUMN IF NOT EXISTS delivery_window_end date,
  ADD COLUMN IF NOT EXISTS fulfilment_blocked_reason text,
  -- Frozen at order creation so a later owner edit of their address
  -- cannot change where an already paid order goes (spec AC-23). Read by
  -- the service role for fulfilment and by nothing else.
  ADD COLUMN IF NOT EXISTS recipient_destination_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gifvtme_orders_order_source_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT gifvtme_orders_order_source_check
      CHECK (order_source IN ('self', 'wishlist'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gifvtme_orders_blocked_reason_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT gifvtme_orders_blocked_reason_check
      CHECK (
        fulfilment_blocked_reason IS NULL
        OR fulfilment_blocked_reason IN ('needs_recipient_address', 'claim_conflict')
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS gifvtme_orders_gift_claim
  ON public.orders (gift_claim_id)
  WHERE gift_claim_id IS NOT NULL;

-- AC-25 is explicit that no address is invented when a wishlist has no
-- delivery destination yet: the payment completes and the order is held.
-- That is only possible if the destination columns can be empty for a
-- gift order, so they are relaxed here and a check restores the old
-- guarantee for self purchases, which are unaffected.
ALTER TABLE public.orders ALTER COLUMN shipping_address DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN shipping_city DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN shipping_state DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gifvtme_orders_self_needs_address'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT gifvtme_orders_self_needs_address
      CHECK (
        order_source <> 'self'
        OR (
          shipping_address IS NOT NULL
          AND shipping_city IS NOT NULL
          AND shipping_state IS NOT NULL
        )
      )
      NOT VALID;
  END IF;
END;
$$;

-- NOT VALID so an existing row with a historic gap cannot block this
-- deployment. Validate separately once the table is known clean:
--   ALTER TABLE public.orders VALIDATE CONSTRAINT gifvtme_orders_self_needs_address;

-- ---------------------------------------------------------------------
-- 4. Claim functions (build plan step 2)
-- ---------------------------------------------------------------------

-- Creates the one active claim for an item, or reports why it could not.
-- SECURITY DEFINER because wishlist_gift_claims has no write policy; the
-- caller check is auth.uid(), and readability of the wishlist is checked
-- with the same helper the shared wishlist itself uses, so this grants no
-- access the caller did not already have.
CREATE OR REPLACE FUNCTION public.gifvtme_claim_wishlist_item(
  p_item_id uuid,
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
  target_item record;
  existing_claim record;
  active_claim_count integer;
  created_claim record;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT item.id, item.wishlist_id, item.status::text AS status, item.origin::text AS origin
  INTO target_item
  FROM public.wishlist_items item
  WHERE item.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.gifvtme_can_read_wishlist_by_id(target_item.wishlist_id) THEN
    -- Same deliberate conflation the wishlist routes already use: a
    -- missing item and an item the caller may not see are one answer, so
    -- this cannot be used to probe for private wishlists.
    RAISE EXCEPTION 'not_found';
  END IF;

  IF target_item.origin <> 'catalog' THEN
    RAISE EXCEPTION 'external_origin';
  END IF;

  IF target_item.status = 'purchased' THEN
    RAISE EXCEPTION 'already_purchased';
  END IF;

  IF target_item.status <> 'available' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  -- Retire anything on this item whose clock has run out before looking
  -- for a live claim, so expiry is decided here rather than at read time.
  UPDATE public.wishlist_gift_claims
  SET state = 'expired',
      released_at = now(),
      release_reason = 'expired',
      updated_at = now()
  WHERE wishlist_item_id = p_item_id
    AND state IN ('reserved', 'checking_out')
    AND expires_at <= now();

  SELECT claim.id, claim.claimant_user_id, claim.state, claim.expires_at
  INTO existing_claim
  FROM public.wishlist_gift_claims claim
  WHERE claim.wishlist_item_id = p_item_id
    AND claim.state IN ('reserved', 'checking_out', 'purchased')
  LIMIT 1;

  IF FOUND THEN
    IF existing_claim.claimant_user_id = acting_user THEN
      -- Idempotent: a retry after an ambiguous network response resolves
      -- to the claim that already exists rather than failing or making a
      -- second one (spec AC-11).
      RETURN jsonb_build_object(
        'claim_id', existing_claim.id,
        'state', existing_claim.state,
        'expires_at', existing_claim.expires_at,
        'already_owned', true
      );
    END IF;

    IF existing_claim.state = 'purchased' THEN
      RAISE EXCEPTION 'already_purchased';
    END IF;

    RAISE EXCEPTION 'already_reserved';
  END IF;

  SELECT count(*) INTO active_claim_count
  FROM public.wishlist_gift_claims
  WHERE claimant_user_id = acting_user
    AND state IN ('reserved', 'checking_out')
    AND expires_at > now();

  IF active_claim_count >= p_max_active_claims THEN
    RAISE EXCEPTION 'too_many_claims';
  END IF;

  INSERT INTO public.wishlist_gift_claims (
    wishlist_item_id,
    wishlist_id,
    claimant_user_id,
    state,
    reserved_at,
    expires_at,
    reserved_expires_at
  )
  VALUES (
    p_item_id,
    target_item.wishlist_id,
    acting_user,
    'reserved',
    now(),
    now() + make_interval(hours => p_reservation_hours),
    now() + make_interval(hours => p_reservation_hours)
  )
  RETURNING id, state, expires_at INTO created_claim;

  RETURN jsonb_build_object(
    'claim_id', created_claim.id,
    'state', created_claim.state,
    'expires_at', created_claim.expires_at,
    'already_owned', false
  );
EXCEPTION
  WHEN unique_violation THEN
    -- The partial unique index is the real arbiter of the race. Whoever
    -- loses it lands here and is told the truth.
    RAISE EXCEPTION 'already_reserved';
END;
$$;

-- Releasing is limited to the person who reserved. The wishlist owner
-- cannot release a claim, because the owner is not allowed to know one
-- exists.
CREATE OR REPLACE FUNCTION public.gifvtme_release_wishlist_item_claim(
  p_item_id uuid,
  p_release_reason text DEFAULT 'claimant_released'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  released_count integer;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.wishlist_gift_claims
  SET state = 'released',
      released_at = now(),
      release_reason = p_release_reason,
      updated_at = now()
  WHERE wishlist_item_id = p_item_id
    AND claimant_user_id = acting_user
    AND state IN ('reserved', 'checking_out');

  GET DIAGNOSTICS released_count = ROW_COUNT;

  IF released_count = 0 THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN jsonb_build_object('released', true);
END;
$$;

-- Resolves the caller's own live claim on an item. POST /api/checkout uses
-- this to derive the wishlist association from the session instead of
-- trusting a client supplied id, which is the whole point of spec AC-38.
CREATE OR REPLACE FUNCTION public.gifvtme_get_active_claim(p_item_id uuid)
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
  WHERE claim.wishlist_item_id = p_item_id
    AND claim.claimant_user_id = acting_user
    AND claim.state IN ('reserved', 'checking_out')
    AND claim.expires_at > now()
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

GRANT EXECUTE ON FUNCTION public.gifvtme_claim_wishlist_item(uuid, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_release_wishlist_item_claim(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_get_active_claim(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Expose a reserved boolean, and nothing else (build plan step 7)
-- ---------------------------------------------------------------------

-- Rebuilt from migration 006's definition with one addition: is_reserved.
-- The claim's id, its state and above all its claimant are not exposed.
-- Other visitors learn that somebody has this one, never who (spec AC-20,
-- AC-21). This view is not security_invoker, so the lateral join reads
-- claims past their own row level security on purpose; a boolean is the
-- entire payload.
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
    WHEN active_claim.state = 'purchased' THEN 'purchased'
    ELSE item.status::text
  END AS status,
  item.is_exclusive,
  item.sort_order,
  item.created_at,
  item.intent_flagged_by,
  item.intent_flagged_at,
  purchase.created_at AS affiliate_purchased_at,
  gift_order.status AS order_status,
  -- Everybody except the owner. A giver needs to know somebody already has
  -- this one; the owner must not, because that is the surprise (spec
  -- AC-20 and AC-21). Deciding it here rather than in a page means no
  -- future query can forget.
  (
    active_claim.id IS NOT NULL
    AND active_claim.state IN ('reserved', 'checking_out')
    AND NOT public.gifvtme_is_wishlist_owner(item.wishlist_id)
  ) AS is_reserved
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
LEFT JOIN LATERAL (
  SELECT
    claim_record.id,
    claim_record.state
  FROM public.wishlist_gift_claims claim_record
  WHERE claim_record.wishlist_item_id = item.id
    AND (
      claim_record.state = 'purchased'
      OR (
        claim_record.state IN ('reserved', 'checking_out')
        AND claim_record.expires_at > now()
      )
    )
  ORDER BY CASE claim_record.state WHEN 'purchased' THEN 0 ELSE 1 END
  LIMIT 1
) active_claim ON true
WHERE public.gifvtme_can_read_wishlist_by_id(item.wishlist_id);

GRANT SELECT ON public.wishlist_items_with_status TO anon, authenticated;

COMMIT;
