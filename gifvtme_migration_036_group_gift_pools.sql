-- Migration 036: activate the group_gift_pools feature described in
-- context/feature-specs/21-GIFT-POOLING.md.
--
-- Migration 032's gift_pools ledger remains a separate, service-only model.
-- This additive schema implements the feature spec's public pool links,
-- contributions, and manual ops payout records without changing that ledger.

BEGIN;

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS gifting_type text NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wishlist_items_gifting_type_check'
      AND conrelid = 'public.wishlist_items'::regclass
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_gifting_type_check
      CHECK (gifting_type IN ('individual', 'group'));
  END IF;
END;
$$;

-- The feature spec reserves this table ahead of feature activation, so it can
-- already exist (usually with only its id column). Keep and extend it.
DO $$
DECLARE
  has_missing_required_columns boolean;
  has_existing_rows boolean;
BEGIN
  IF to_regclass('public.group_gift_pools') IS NOT NULL THEN
    SELECT NOT (
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.group_gift_pools'::regclass AND attname = 'wishlist_id' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.group_gift_pools'::regclass AND attname = 'created_by' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.group_gift_pools'::regclass AND attname = 'receiver_id' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.group_gift_pools'::regclass AND attname = 'title' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.group_gift_pools'::regclass AND attname = 'target_amount' AND NOT attisdropped)
    ) INTO has_missing_required_columns;

    IF has_missing_required_columns THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.group_gift_pools LIMIT 1)'
        INTO has_existing_rows;
      IF has_existing_rows THEN
        RAISE EXCEPTION 'public.group_gift_pools contains rows but is missing required feature columns'
          USING HINT = 'Inspect and migrate existing rows before rerunning migration 036.';
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.group_gift_pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wishlist_id uuid NOT NULL,
  wishlist_item_id uuid,
  created_by uuid NOT NULL,
  receiver_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  target_amount numeric(14, 2) NOT NULL,
  amount_raised numeric(14, 2) NOT NULL DEFAULT 0,
  min_contribution numeric(14, 2) NOT NULL DEFAULT 1500,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  contributors_visible boolean NOT NULL DEFAULT true,
  fully_funded_at timestamptz,
  cashed_out_at timestamptz,
  cashed_out_amount numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_gift_pools_pkey PRIMARY KEY (id),
  CONSTRAINT group_gift_pools_wishlist_id_fkey
    FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id) ON DELETE RESTRICT,
  CONSTRAINT group_gift_pools_wishlist_item_id_fkey
    FOREIGN KEY (wishlist_item_id) REFERENCES public.wishlist_items(id) ON DELETE RESTRICT,
  CONSTRAINT group_gift_pools_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT group_gift_pools_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT group_gift_pools_token_key UNIQUE (token),
  CONSTRAINT group_gift_pools_title_check CHECK (char_length(title) BETWEEN 3 AND 100),
  CONSTRAINT group_gift_pools_message_check CHECK (message IS NULL OR char_length(message) <= 300),
  CONSTRAINT group_gift_pools_target_amount_check
    CHECK (target_amount >= 1500 AND target_amount = trunc(target_amount)),
  CONSTRAINT group_gift_pools_amount_raised_check
    CHECK (amount_raised >= 0 AND amount_raised = trunc(amount_raised)),
  CONSTRAINT group_gift_pools_min_contribution_check
    CHECK (min_contribution BETWEEN 1500 AND 5000 AND min_contribution = trunc(min_contribution)),
  CONSTRAINT group_gift_pools_status_check
    CHECK (status IN ('open', 'fully_funded', 'procured', 'paid_out', 'cancelled')),
  CONSTRAINT group_gift_pools_amount_target_check CHECK (amount_raised <= target_amount),
  CONSTRAINT group_gift_pools_item_status_check
    CHECK ((wishlist_item_id IS NOT NULL) OR status NOT IN ('fully_funded', 'procured')),
  CONSTRAINT group_gift_pools_procured_item_check
    CHECK (status <> 'procured' OR wishlist_item_id IS NOT NULL),
  CONSTRAINT group_gift_pools_paid_out_check
    CHECK (status <> 'paid_out' OR (cashed_out_at IS NOT NULL AND cashed_out_amount IS NOT NULL))
);

ALTER TABLE public.group_gift_pools
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS wishlist_id uuid,
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS receiver_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS target_amount numeric(14, 2),
  ADD COLUMN IF NOT EXISTS amount_raised numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_contribution numeric(14, 2) DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS contributors_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS fully_funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashed_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashed_out_amount numeric(14, 2),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.group_gift_pools
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN wishlist_id SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN receiver_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN target_amount SET NOT NULL,
  ALTER COLUMN amount_raised SET DEFAULT 0,
  ALTER COLUMN amount_raised SET NOT NULL,
  ALTER COLUMN min_contribution SET DEFAULT 1500,
  ALTER COLUMN min_contribution SET NOT NULL,
  ALTER COLUMN token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN token SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN contributors_visible SET DEFAULT true,
  ALTER COLUMN contributors_visible SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.group_gift_pools'::regclass
      AND c.contype IN ('p', 'u')
      AND c.conkey = ARRAY[(
        SELECT a.attnum
        FROM pg_attribute a
        WHERE a.attrelid = 'public.group_gift_pools'::regclass
          AND a.attname = 'id'
          AND NOT a.attisdropped
      )]::smallint[]
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.group_gift_pools'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_id_key UNIQUE (id);
    ELSE
      ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_pkey PRIMARY KEY (id);
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_wishlist_id_fkey') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_wishlist_item_id_fkey') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_wishlist_item_id_fkey FOREIGN KEY (wishlist_item_id) REFERENCES public.wishlist_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_created_by_fkey') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_receiver_id_fkey') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_token_key') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_token_key UNIQUE (token);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_title_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_title_check CHECK (char_length(title) BETWEEN 3 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_message_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_message_check CHECK (message IS NULL OR char_length(message) <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_target_amount_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_target_amount_check CHECK (target_amount >= 1500 AND target_amount = trunc(target_amount));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_amount_raised_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_amount_raised_check CHECK (amount_raised >= 0 AND amount_raised = trunc(amount_raised));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_min_contribution_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_min_contribution_check CHECK (min_contribution BETWEEN 1500 AND 5000 AND min_contribution = trunc(min_contribution));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_status_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_status_check CHECK (status IN ('open', 'fully_funded', 'procured', 'paid_out', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_amount_target_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_amount_target_check CHECK (amount_raised <= target_amount);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_item_status_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_item_status_check CHECK ((wishlist_item_id IS NOT NULL) OR status NOT IN ('fully_funded', 'procured'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_procured_item_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_procured_item_check CHECK (status <> 'procured' OR wishlist_item_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.group_gift_pools'::regclass AND conname = 'group_gift_pools_paid_out_check') THEN
    ALTER TABLE public.group_gift_pools ADD CONSTRAINT group_gift_pools_paid_out_check CHECK (status <> 'paid_out' OR (cashed_out_at IS NOT NULL AND cashed_out_amount IS NOT NULL));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS group_gift_pools_token_idx
  ON public.group_gift_pools(token);
CREATE INDEX IF NOT EXISTS group_gift_pools_receiver_idx
  ON public.group_gift_pools(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_gift_pools_creator_idx
  ON public.group_gift_pools(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS group_gift_pools_wishlist_item_idx
  ON public.group_gift_pools(wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS group_gift_pools_active_item_idx
  ON public.group_gift_pools(wishlist_item_id, status)
  WHERE wishlist_item_id IS NOT NULL AND status IN ('open', 'fully_funded');

CREATE TABLE IF NOT EXISTS public.pool_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.group_gift_pools(id) ON DELETE RESTRICT,
  contributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0 AND amount = trunc(amount)),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'failed')),
  flutterwave_transaction_id text UNIQUE,
  idempotency_key text NOT NULL,
  payment_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  applied_to_pool boolean NOT NULL DEFAULT false,
  notes text,
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contributor_id, idempotency_key),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS pool_contributions_pool_id_idx
  ON public.pool_contributions(pool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pool_contributions_contributor_idx
  ON public.pool_contributions(contributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pool_contributions_pending_reservations_idx
  ON public.pool_contributions(pool_id, payment_expires_at)
  WHERE status = 'pending_payment';

CREATE TABLE IF NOT EXISTS public.pool_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL UNIQUE REFERENCES public.group_gift_pools(id) ON DELETE RESTRICT,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0 AND amount = trunc(amount)),
  status text NOT NULL DEFAULT 'pending_ops_action'
    CHECK (status IN ('pending_ops_action', 'processing', 'completed')),
  bank_name text,
  account_number text,
  account_name text,
  processed_by text,
  processed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_gift_pool_progress (
  pool_id uuid PRIMARY KEY REFERENCES public.group_gift_pools(id) ON DELETE CASCADE,
  amount_raised numeric(14, 2) NOT NULL DEFAULT 0,
  target_amount numeric(14, 2) NOT NULL,
  contributor_count integer NOT NULL DEFAULT 0 CHECK (contributor_count >= 0),
  status text NOT NULL CHECK (status IN ('open', 'fully_funded', 'procured', 'paid_out', 'cancelled')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_gift_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_gift_pool_progress ENABLE ROW LEVEL SECURITY;

-- Customer requests use narrow SECURITY DEFINER RPCs below. Raw pool,
-- contribution, and payout rows remain inaccessible to browser clients.
REVOKE ALL ON TABLE public.group_gift_pools, public.pool_contributions,
  public.pool_payouts, public.group_gift_pool_progress
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.group_gift_pools, public.pool_contributions,
  public.pool_payouts, public.group_gift_pool_progress
  FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.group_gift_pools,
  public.pool_contributions, public.pool_payouts,
  public.group_gift_pool_progress TO service_role;

-- Realtime publishes only progress values. Contributor identity, messages,
-- share tokens, creator/receiver ids, and payout details are kept off this
-- public-facing table.
DROP POLICY IF EXISTS group_gift_pool_progress_public_read ON public.group_gift_pool_progress;
CREATE POLICY group_gift_pool_progress_public_read
  ON public.group_gift_pool_progress FOR SELECT
  TO anon, authenticated USING (true);
GRANT SELECT ON public.group_gift_pool_progress TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'group_gift_pool_progress'
     ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.group_gift_pool_progress;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_refresh_group_gift_pool_progress(p_pool_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_pool record;
  paid_count integer;
BEGIN
  SELECT id, amount_raised, target_amount, status
  INTO target_pool
  FROM public.group_gift_pools
  WHERE id = p_pool_id;

  IF NOT FOUND THEN
    DELETE FROM public.group_gift_pool_progress WHERE pool_id = p_pool_id;
    RETURN;
  END IF;

  SELECT count(DISTINCT contributor_id)::integer INTO paid_count
  FROM public.pool_contributions
  WHERE pool_id = p_pool_id AND status = 'paid' AND applied_to_pool;

  INSERT INTO public.group_gift_pool_progress (
    pool_id, amount_raised, target_amount, contributor_count, status, updated_at
  ) VALUES (
    target_pool.id, target_pool.amount_raised, target_pool.target_amount,
    paid_count, target_pool.status, now()
  )
  ON CONFLICT (pool_id) DO UPDATE SET
    amount_raised = EXCLUDED.amount_raised,
    target_amount = EXCLUDED.target_amount,
    contributor_count = EXCLUDED.contributor_count,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_sync_group_gift_pool_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.gifvtme_refresh_group_gift_pool_progress(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.gifvtme_refresh_group_gift_pool_progress(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_sync_group_gift_contribution_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.gifvtme_refresh_group_gift_pool_progress(NEW.pool_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_gift_pools_sync_progress ON public.group_gift_pools;
CREATE TRIGGER group_gift_pools_sync_progress
AFTER INSERT OR UPDATE OF amount_raised, target_amount, status
ON public.group_gift_pools
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_sync_group_gift_pool_progress();

DROP TRIGGER IF EXISTS pool_contributions_sync_progress ON public.pool_contributions;
CREATE TRIGGER pool_contributions_sync_progress
AFTER INSERT OR UPDATE OF status, applied_to_pool
ON public.pool_contributions
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_sync_group_gift_contribution_progress();

CREATE OR REPLACE FUNCTION public.gifvtme_create_group_gift_pool(
  p_wishlist_id uuid,
  p_wishlist_item_id uuid,
  p_receiver_id uuid,
  p_title text,
  p_target_amount numeric,
  p_min_contribution numeric,
  p_message text,
  p_contributors_visible boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  target_wishlist record;
  target_item record;
  target_receiver_name text;
  final_title text;
  created_pool public.group_gift_pools%ROWTYPE;
BEGIN
  IF acting_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_target_amount IS NULL OR p_target_amount < 1500 OR p_target_amount <> trunc(p_target_amount) THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF p_min_contribution IS NULL OR p_min_contribution NOT BETWEEN 1500 AND 5000
     OR p_min_contribution <> trunc(p_min_contribution) THEN
    RAISE EXCEPTION 'invalid_minimum';
  END IF;
  IF p_message IS NOT NULL AND char_length(p_message) > 300 THEN
    RAISE EXCEPTION 'invalid_message';
  END IF;

  SELECT wishlist.id, wishlist.user_id, wishlist.visibility, profile.full_name
  INTO target_wishlist
  FROM public.wishlists wishlist
  JOIN public.users profile ON profile.id = wishlist.user_id
  WHERE wishlist.id = p_wishlist_id
  FOR SHARE OF wishlist;

  IF NOT FOUND OR target_wishlist.user_id <> p_receiver_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF target_wishlist.user_id <> acting_user THEN
    IF target_wishlist.visibility = 'private'
       OR NOT public.gifvtme_can_read_wishlist_by_id(p_wishlist_id) THEN
      RAISE EXCEPTION 'not_found';
    END IF;
  END IF;

  SELECT full_name INTO target_receiver_name
  FROM public.users WHERE id = p_receiver_id;

  IF p_wishlist_item_id IS NOT NULL THEN
    SELECT item.id, item.wishlist_id, item.title, item.status::text AS status,
           item.master_item_id, item.gifting_type
    INTO target_item
    FROM public.wishlist_items item
    WHERE item.id = p_wishlist_item_id AND item.wishlist_id = p_wishlist_id
    FOR UPDATE;

    IF NOT FOUND OR target_item.status <> 'available' THEN
      RAISE EXCEPTION 'item_unavailable';
    END IF;

  IF EXISTS (
      SELECT 1 FROM public.wishlist_gift_claims claim
      WHERE claim.wishlist_item_id = p_wishlist_item_id
        AND (
          claim.state = 'purchased'
          OR (claim.state IN ('reserved', 'checking_out') AND claim.expires_at > now())
        )
    ) THEN
      RAISE EXCEPTION 'item_reserved';
    END IF;

    PERFORM set_config('gifvtme.allow_gifting_type_change', 'on', true);
    UPDATE public.wishlist_items SET gifting_type = 'group'
    WHERE id = p_wishlist_item_id;
  END IF;

  final_title := nullif(btrim(p_title), '');
  IF final_title IS NULL THEN
    final_title := CASE
      WHEN p_wishlist_item_id IS NOT NULL THEN target_item.title
      ELSE coalesce(nullif(btrim(target_receiver_name), ''), 'Their') || '''s Gift Fund'
    END;
  END IF;

  IF char_length(final_title) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  INSERT INTO public.group_gift_pools (
    wishlist_id, wishlist_item_id, created_by, receiver_id, title,
    target_amount, min_contribution, message, contributors_visible
  ) VALUES (
    p_wishlist_id, p_wishlist_item_id, acting_user, p_receiver_id, final_title,
    p_target_amount, coalesce(p_min_contribution, 1500), nullif(btrim(p_message), ''),
    coalesce(p_contributors_visible, true)
  )
  RETURNING * INTO created_pool;

  RETURN to_jsonb(created_pool);
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_reserve_group_pool_contribution(
  p_pool_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  target_pool record;
  existing_contribution record;
  reserved_amount numeric;
  remaining_amount numeric;
  accepted_amount numeric;
  created_contribution record;
BEGIN
  IF acting_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> trunc(p_amount) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  SELECT * INTO target_pool
  FROM public.group_gift_pools
  WHERE id = p_pool_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT id, pool_id, amount, status, payment_expires_at INTO existing_contribution
  FROM public.pool_contributions
  WHERE contributor_id = acting_user AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_contribution.pool_id <> p_pool_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;
    RETURN jsonb_build_object(
      'contribution_id', existing_contribution.id,
      'amount', existing_contribution.amount,
      'status', existing_contribution.status,
      'payment_expires_at', existing_contribution.payment_expires_at,
      'idempotent_replay', true
    );
  END IF;

  IF target_pool.status <> 'open' THEN RAISE EXCEPTION 'pool_closed'; END IF;

  SELECT coalesce(sum(amount), 0) INTO reserved_amount
  FROM public.pool_contributions
  WHERE pool_id = p_pool_id
    AND status = 'pending_payment'
    AND payment_expires_at > now();

  remaining_amount := target_pool.target_amount - target_pool.amount_raised - reserved_amount;
  accepted_amount := least(p_amount, remaining_amount);
  IF accepted_amount < target_pool.min_contribution THEN
    RAISE EXCEPTION 'minimum_contribution:%', target_pool.min_contribution;
  END IF;

  INSERT INTO public.pool_contributions (
    pool_id, contributor_id, amount, status, idempotency_key, payment_expires_at
  ) VALUES (
    p_pool_id, acting_user, accepted_amount, 'pending_payment', p_idempotency_key,
    now() + interval '30 minutes'
  )
  RETURNING id, amount, status, payment_expires_at INTO created_contribution;

  RETURN jsonb_build_object(
    'contribution_id', created_contribution.id,
    'amount', created_contribution.amount,
    'status', created_contribution.status,
    'payment_expires_at', created_contribution.payment_expires_at,
    'idempotent_replay', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_update_group_gift_pool_title(
  p_pool_id uuid,
  p_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  target_pool record;
  clean_title text := nullif(btrim(p_title), '');
BEGIN
  IF acting_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF clean_title IS NULL OR char_length(clean_title) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  SELECT id, receiver_id INTO target_pool
  FROM public.group_gift_pools
  WHERE id = p_pool_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF acting_user <> target_pool.receiver_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.group_gift_pools SET title = clean_title WHERE id = p_pool_id;
  RETURN jsonb_build_object('updated', true, 'title', clean_title);
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_fail_group_pool_contribution(p_contribution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.pool_contributions
  SET status = 'failed', updated_at = now()
  WHERE id = p_contribution_id AND status = 'pending_payment';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN jsonb_build_object('failed', updated_rows = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_confirm_group_pool_contribution(
  p_contribution_id uuid,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool_id uuid;
  target_pool record;
  target_contribution record;
  next_amount numeric;
  next_status text;
  newly_funded boolean := false;
  refund_required boolean := false;
  payout_id uuid;
BEGIN
  SELECT contribution.pool_id INTO pool_id
  FROM public.pool_contributions contribution
  WHERE contribution.id = p_contribution_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'not_found'); END IF;

  SELECT * INTO target_pool FROM public.group_gift_pools
  WHERE id = pool_id FOR UPDATE;
  SELECT * INTO target_contribution FROM public.pool_contributions
  WHERE id = p_contribution_id FOR UPDATE;

  IF target_contribution.status = 'paid' THEN
    RETURN jsonb_build_object('outcome', 'already_paid', 'pool_id', pool_id,
      'applied_to_pool', target_contribution.applied_to_pool,
      'refund_required', NOT target_contribution.applied_to_pool);
  END IF;
  IF target_contribution.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('outcome', 'not_pending', 'pool_id', pool_id);
  END IF;

  next_amount := target_pool.amount_raised + target_contribution.amount;
  IF target_pool.status <> 'open' OR next_amount > target_pool.target_amount THEN
    refund_required := true;
    UPDATE public.pool_contributions
    SET status = 'paid',
        applied_to_pool = false,
        notes = 'Pool closed during payment — refund required.',
        flutterwave_transaction_id = p_transaction_id,
        paid_at = now(),
        updated_at = now()
    WHERE id = p_contribution_id;
  ELSE
    next_status := CASE
      WHEN next_amount >= target_pool.target_amount AND target_pool.wishlist_item_id IS NOT NULL
        THEN 'fully_funded'
      WHEN next_amount >= target_pool.target_amount THEN 'paid_out'
      ELSE 'open'
    END;
    newly_funded := next_amount >= target_pool.target_amount;

    UPDATE public.pool_contributions
    SET status = 'paid', applied_to_pool = true,
        flutterwave_transaction_id = p_transaction_id, paid_at = now(), updated_at = now()
    WHERE id = p_contribution_id;

    UPDATE public.group_gift_pools
    SET amount_raised = next_amount,
        status = next_status,
        fully_funded_at = CASE WHEN newly_funded THEN now() ELSE fully_funded_at END,
        cashed_out_at = CASE WHEN next_status = 'paid_out' THEN now() ELSE cashed_out_at END,
        cashed_out_amount = CASE WHEN next_status = 'paid_out' THEN next_amount ELSE cashed_out_amount END
    WHERE id = pool_id;

    IF next_status = 'paid_out' THEN
      INSERT INTO public.pool_payouts(pool_id, receiver_id, amount)
      VALUES (pool_id, target_pool.receiver_id, next_amount)
      ON CONFLICT (pool_id) DO NOTHING
      RETURNING id INTO payout_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'paid',
    'pool_id', pool_id,
    'pool_status', CASE WHEN refund_required THEN target_pool.status ELSE next_status END,
    'newly_funded', newly_funded,
    'refund_required', refund_required,
    'payout_id', payout_id,
    'amount', target_contribution.amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_cash_out_group_gift_pool(p_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  target_pool record;
  payout_id uuid;
  updated_item_id uuid;
BEGIN
  IF acting_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO target_pool FROM public.group_gift_pools
  WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF acting_user NOT IN (target_pool.receiver_id, target_pool.created_by) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF target_pool.status = 'cancelled' THEN RAISE EXCEPTION 'pool_cancelled'; END IF;
  IF target_pool.status = 'paid_out' THEN
    SELECT id INTO payout_id FROM public.pool_payouts WHERE pool_id = p_pool_id;
    RETURN jsonb_build_object('cashed_out', true, 'amount', target_pool.cashed_out_amount,
      'payout_id', payout_id, 'already_paid_out', true);
  END IF;
  IF target_pool.status NOT IN ('open', 'fully_funded') THEN RAISE EXCEPTION 'pool_closed'; END IF;

  UPDATE public.group_gift_pools
  SET status = 'paid_out', cashed_out_at = now(), cashed_out_amount = amount_raised
  WHERE id = p_pool_id;

  INSERT INTO public.pool_payouts(pool_id, receiver_id, amount)
  VALUES (p_pool_id, target_pool.receiver_id, target_pool.amount_raised)
  ON CONFLICT (pool_id) DO UPDATE SET amount = EXCLUDED.amount
  RETURNING id INTO payout_id;

  UPDATE public.pool_contributions
  SET notes = 'Pool closed during payment — refund required.', updated_at = now()
  WHERE pool_id = p_pool_id AND status = 'pending_payment';

  IF target_pool.wishlist_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.group_gift_pools other_pool
       WHERE other_pool.wishlist_item_id = target_pool.wishlist_item_id
         AND other_pool.id <> p_pool_id
         AND other_pool.status IN ('open', 'fully_funded')
     ) THEN
    PERFORM set_config('gifvtme.allow_gifting_type_change', 'on', true);
    UPDATE public.wishlist_items SET gifting_type = 'individual'
    WHERE id = target_pool.wishlist_item_id AND status = 'available';
  END IF;

  RETURN jsonb_build_object('cashed_out', true, 'amount', target_pool.amount_raised,
    'payout_id', payout_id, 'already_paid_out', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_cancel_group_gift_pool(p_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
  target_pool record;
BEGIN
  IF acting_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO target_pool FROM public.group_gift_pools
  WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF acting_user <> target_pool.created_by THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF target_pool.amount_raised > 0 THEN RAISE EXCEPTION 'has_contributions'; END IF;
  IF target_pool.status <> 'open' THEN RAISE EXCEPTION 'pool_closed'; END IF;

  UPDATE public.group_gift_pools SET status = 'cancelled' WHERE id = p_pool_id;
  UPDATE public.pool_contributions
  SET notes = 'Pool cancelled during payment — refund required.', updated_at = now()
  WHERE pool_id = p_pool_id AND status = 'pending_payment';

  IF target_pool.wishlist_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.group_gift_pools other_pool
       WHERE other_pool.wishlist_item_id = target_pool.wishlist_item_id
         AND other_pool.id <> p_pool_id
         AND other_pool.status IN ('open', 'fully_funded')
     ) THEN
    PERFORM set_config('gifvtme.allow_gifting_type_change', 'on', true);
    UPDATE public.wishlist_items SET gifting_type = 'individual'
    WHERE id = target_pool.wishlist_item_id AND status = 'available';
  END IF;

  RETURN jsonb_build_object('cancelled', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_procure_group_gift_pool(p_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_pool record;
  target_master_item uuid;
  changed_rows integer;
BEGIN
  SELECT * INTO target_pool FROM public.group_gift_pools
  WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF target_pool.wishlist_item_id IS NULL OR target_pool.status <> 'fully_funded' THEN
    RAISE EXCEPTION 'pool_not_ready_for_procurement';
  END IF;

  UPDATE public.group_gift_pools SET status = 'procured' WHERE id = p_pool_id;
  UPDATE public.wishlist_items
  SET status = 'purchased'
  WHERE id = target_pool.wishlist_item_id AND status = 'available';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN RAISE EXCEPTION 'item_unavailable'; END IF;

  SELECT master_item_id INTO target_master_item
  FROM public.wishlist_items WHERE id = target_pool.wishlist_item_id;
  IF target_master_item IS NOT NULL THEN
    UPDATE public.master_items SET status = 'purchased' WHERE id = target_master_item;
  END IF;

  RETURN jsonb_build_object('procured', true, 'pool_id', p_pool_id);
END;
$$;

-- A group pool reserves an item for group gifting. Serialize this check
-- with pool creation so catalog claims cannot race a new pool.
CREATE OR REPLACE FUNCTION public.gifvtme_reject_claim_for_group_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item_gifting_type text;
BEGIN
  SELECT gifting_type INTO item_gifting_type
  FROM public.wishlist_items WHERE id = NEW.wishlist_item_id FOR UPDATE;
  IF item_gifting_type = 'group' THEN RAISE EXCEPTION 'group_pool_active'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wishlist_gift_claims_reject_group_pool ON public.wishlist_gift_claims;
CREATE TRIGGER wishlist_gift_claims_reject_group_pool
BEFORE INSERT ON public.wishlist_gift_claims
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_reject_claim_for_group_pool();

CREATE OR REPLACE FUNCTION public.gifvtme_reject_external_purchase_for_group_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item_gifting_type text;
BEGIN
  SELECT gifting_type INTO item_gifting_type
  FROM public.wishlist_items WHERE id = NEW.wishlist_item_id FOR UPDATE;
  IF item_gifting_type = 'group' AND EXISTS (
    SELECT 1 FROM public.group_gift_pools pool
    WHERE pool.wishlist_item_id = NEW.wishlist_item_id
      AND pool.status IN ('open', 'fully_funded')
  ) THEN
    RAISE EXCEPTION 'group_pool_active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchases_reject_group_pool_item ON public.purchases;
CREATE TRIGGER purchases_reject_group_pool_item
BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_reject_external_purchase_for_group_pool();

-- External confirmation and catalog order completion must not claim a
-- group-pooled item. Procurement first moves the pool to procured, in the
-- same transaction, so its legitimate item update passes this guard.
CREATE OR REPLACE FUNCTION public.gifvtme_reject_solo_purchase_for_group_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'purchased'
     AND OLD.status::text <> 'purchased'
     AND OLD.gifting_type = 'group'
     AND EXISTS (
       SELECT 1 FROM public.group_gift_pools pool
       WHERE pool.wishlist_item_id = OLD.id
         AND pool.status IN ('open', 'fully_funded')
     ) THEN
    RAISE EXCEPTION 'group_pool_active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wishlist_items_reject_solo_group_pool_purchase ON public.wishlist_items;
CREATE TRIGGER wishlist_items_reject_solo_group_pool_purchase
BEFORE UPDATE OF status ON public.wishlist_items
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_reject_solo_purchase_for_group_pool();

CREATE OR REPLACE FUNCTION public.gifvtme_protect_wishlist_gifting_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gifting_type IS DISTINCT FROM OLD.gifting_type
     AND current_setting('gifvtme.allow_gifting_type_change', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'gifting_type_is_managed_by_group_pool';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wishlist_items_protect_gifting_type ON public.wishlist_items;
CREATE TRIGGER wishlist_items_protect_gifting_type
BEFORE UPDATE OF gifting_type ON public.wishlist_items
FOR EACH ROW EXECUTE FUNCTION public.gifvtme_protect_wishlist_gifting_type();

REVOKE ALL ON FUNCTION public.gifvtme_refresh_group_gift_pool_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_sync_group_gift_pool_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_sync_group_gift_contribution_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_reject_claim_for_group_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_reject_external_purchase_for_group_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_reject_solo_purchase_for_group_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_protect_wishlist_gifting_type() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_create_group_gift_pool(uuid, uuid, uuid, text, numeric, numeric, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gifvtme_reserve_group_pool_contribution(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gifvtme_update_group_gift_pool_title(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gifvtme_fail_group_pool_contribution(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_confirm_group_pool_contribution(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_cash_out_group_gift_pool(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gifvtme_cancel_group_gift_pool(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gifvtme_procure_group_gift_pool(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gifvtme_create_group_gift_pool(uuid, uuid, uuid, text, numeric, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_reserve_group_pool_contribution(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_update_group_gift_pool_title(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_cash_out_group_gift_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_cancel_group_gift_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_fail_group_pool_contribution(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gifvtme_confirm_group_pool_contribution(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gifvtme_procure_group_gift_pool(uuid) TO service_role;

COMMIT;
