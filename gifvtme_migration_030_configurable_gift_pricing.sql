-- Spec 0003, additive pricing foundation. Rates deliberately start unset.
-- Apply to development first and inspect existing orders policies before rollout.
-- This migration adds no checkout route and never changes an existing order.
BEGIN;

CREATE TABLE public.gift_pricing_policies (
  key text PRIMARY KEY CHECK (key IN ('linked', 'manual_sourced', 'manual_cash', 'partial_cash_payout')),
  active_version_id uuid,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gift_pricing_rate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL REFERENCES public.gift_pricing_policies(key),
  version integer NOT NULL CHECK (version > 0),
  rate_bps integer NOT NULL CHECK (rate_bps >= 0 AND rate_bps <= CASE WHEN policy_key = 'partial_cash_payout' THEN 9999 ELSE 50000 END),
  published_at timestamptz NOT NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  publisher_audit_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  UNIQUE (policy_key, version),
  UNIQUE (policy_key, id)
);
CREATE INDEX gift_pricing_rate_publisher_idx ON public.gift_pricing_rate_versions(published_by);
CREATE INDEX gift_pricing_rate_history_idx ON public.gift_pricing_rate_versions(published_at DESC, id DESC);
ALTER TABLE public.gift_pricing_policies ADD CONSTRAINT gift_pricing_active_version_fk
  FOREIGN KEY (key, active_version_id) REFERENCES public.gift_pricing_rate_versions(policy_key, id);
CREATE INDEX gift_pricing_active_version_idx ON public.gift_pricing_policies(active_version_id);
INSERT INTO public.gift_pricing_policies(key) VALUES ('linked'), ('manual_sourced'), ('manual_cash'), ('partial_cash_payout');

CREATE TABLE public.gift_price_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  subject_audit_id text NOT NULL,
  candidate_id uuid REFERENCES public.gift_museum_candidates(id) ON DELETE SET NULL,
  pricing_path text NOT NULL CHECK (pricing_path IN ('linked', 'manual_sourced', 'manual_cash')),
  rate_version_id uuid NOT NULL,
  subject_fingerprint text NOT NULL,
  item_pricing_revision integer NOT NULL CHECK (item_pricing_revision >= 0),
  variant_snapshot jsonb NOT NULL CHECK (jsonb_typeof(variant_snapshot) = 'object'),
  quantity integer NOT NULL CHECK (quantity = 1),
  -- Unconstrained numeric + scale checks reject excess precision instead of rounding it on insert.
  source_amount_ngn numeric NOT NULL CHECK (source_amount_ngn > 0 AND (
    (pricing_path = 'manual_cash' AND source_amount_ngn < 100000000000000 AND scale(source_amount_ngn) = 0)
    OR (pricing_path <> 'manual_cash' AND source_amount_ngn < 1000000000000 AND scale(source_amount_ngn) <= 2)
  )),
  source_reference text,
  source_checked_at timestamptz,
  delivery_area_key text,
  delivery_area_snapshot jsonb,
  delivery_ngn numeric NOT NULL CHECK (delivery_ngn >= 0 AND delivery_ngn < 100000000000000 AND scale(delivery_ngn) = 0),
  gift_or_recipient_ngn numeric NOT NULL CHECK (gift_or_recipient_ngn >= 0 AND gift_or_recipient_ngn < 100000000000000 AND scale(gift_or_recipient_ngn) = 0),
  cash_fee_ngn numeric NOT NULL CHECK (cash_fee_ngn >= 0 AND cash_fee_ngn < 100000000000000 AND scale(cash_fee_ngn) = 0),
  total_ngn numeric NOT NULL CHECK (total_ngn > 0 AND total_ngn < 100000000000000 AND scale(total_ngn) = 0),
  calculation_version text NOT NULL CHECK (calculation_version = 'gift-pricing-v1'),
  confirmed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at = confirmed_at + interval '24 hours'),
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmer_audit_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'locked', 'expired', 'withdrawn', 'retired_unpaid')),
  state_revision integer NOT NULL DEFAULT 0 CHECK (state_revision >= 0),
  replaces_quote_id uuid REFERENCES public.gift_price_quotes(id),
  parent_paid_quote_id uuid REFERENCES public.gift_price_quotes(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  request_key text NOT NULL,
  request_hash text NOT NULL,
  FOREIGN KEY (pricing_path, rate_version_id) REFERENCES public.gift_pricing_rate_versions(policy_key, id),
  CHECK (total_ngn = gift_or_recipient_ngn + cash_fee_ngn + delivery_ngn),
  CHECK (
    (pricing_path = 'manual_cash' AND source_amount_ngn = gift_or_recipient_ngn AND delivery_ngn = 0
      AND source_reference IS NULL AND source_checked_at IS NULL AND delivery_area_key IS NULL AND delivery_area_snapshot IS NULL)
    OR
    (pricing_path IN ('linked', 'manual_sourced') AND cash_fee_ngn = 0
      AND length(btrim(source_reference)) > 0 AND source_reference IS NOT NULL
      AND source_checked_at IS NOT NULL AND source_checked_at <= confirmed_at AND source_checked_at >= confirmed_at - interval '24 hours'
      AND delivery_area_key IS NOT NULL AND length(btrim(delivery_area_key)) > 0
      AND delivery_area_snapshot IS NOT NULL AND jsonb_typeof(delivery_area_snapshot) = 'object')
  )
);
CREATE UNIQUE INDEX gift_price_one_confirmed_initial_idx ON public.gift_price_quotes(wishlist_item_id)
  WHERE status = 'confirmed' AND parent_paid_quote_id IS NULL;
CREATE UNIQUE INDEX gift_price_one_delivery_revision_idx ON public.gift_price_quotes(parent_paid_quote_id)
  WHERE status = 'confirmed' AND parent_paid_quote_id IS NOT NULL;
CREATE INDEX gift_price_quote_item_idx ON public.gift_price_quotes(wishlist_item_id);
CREATE INDEX gift_price_quote_candidate_idx ON public.gift_price_quotes(candidate_id);
CREATE INDEX gift_price_quote_rate_idx ON public.gift_price_quotes(rate_version_id);
CREATE INDEX gift_price_quote_confirmer_idx ON public.gift_price_quotes(confirmed_by);
CREATE INDEX gift_price_quote_replaces_idx ON public.gift_price_quotes(replaces_quote_id);
CREATE INDEX gift_price_quote_parent_idx ON public.gift_price_quotes(parent_paid_quote_id);
CREATE INDEX gift_price_quote_history_idx ON public.gift_price_quotes(subject_audit_id, confirmed_at DESC);
CREATE INDEX gift_price_quote_expiry_idx ON public.gift_price_quotes(expires_at) WHERE status = 'confirmed';

ALTER TABLE public.wishlist_items
  ADD COLUMN active_price_quote_id uuid REFERENCES public.gift_price_quotes(id),
  ADD COLUMN pricing_revision integer NOT NULL DEFAULT 0 CHECK (pricing_revision >= 0);
CREATE INDEX wishlist_items_active_price_quote_idx ON public.wishlist_items(active_price_quote_id);

CREATE TABLE public.order_pricing_snapshots (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.gift_price_quotes(id),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acceptor_audit_id text NOT NULL,
  accepted_at timestamptz NOT NULL,
  calculation_version text NOT NULL CHECK (calculation_version = 'gift-pricing-v1'),
  calculation_snapshot jsonb NOT NULL CHECK (jsonb_typeof(calculation_snapshot) = 'object'),
  total_ngn numeric NOT NULL CHECK (total_ngn > 0 AND total_ngn < 100000000000000 AND scale(total_ngn) = 0),
  currency text NOT NULL CHECK (currency = 'NGN')
);
CREATE INDEX order_pricing_acceptor_idx ON public.order_pricing_snapshots(accepted_by);

CREATE TABLE public.gift_pricing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text REFERENCES public.gift_pricing_policies(key),
  quote_id uuid REFERENCES public.gift_price_quotes(id),
  order_id uuid REFERENCES public.orders(id),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_audit_id text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('admin', 'buyer', 'system')),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  preview_nonce uuid UNIQUE,
  details jsonb NOT NULL CHECK (jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 16384),
  CHECK (num_nonnulls(policy_key, quote_id, order_id) >= 1),
  UNIQUE (actor_audit_id, event_type, request_key)
);
CREATE INDEX gift_pricing_events_policy_idx ON public.gift_pricing_events(policy_key, occurred_at DESC);
CREATE INDEX gift_pricing_events_quote_idx ON public.gift_pricing_events(quote_id, occurred_at DESC);
CREATE INDEX gift_pricing_events_order_idx ON public.gift_pricing_events(order_id, occurred_at DESC);
CREATE INDEX gift_pricing_events_actor_idx ON public.gift_pricing_events(actor_user_id);

-- Retain historical facts while permitting FK detachment on user/item deletion.
CREATE FUNCTION public.gift_pricing_preserve_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE excluded text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'pricing_history_immutable'; END IF;
  excluded := CASE TG_TABLE_NAME
    WHEN 'gift_pricing_rate_versions' THEN ARRAY['published_by']
    WHEN 'gift_price_quotes' THEN ARRAY['wishlist_item_id','candidate_id','confirmed_by','status','state_revision']
    WHEN 'order_pricing_snapshots' THEN ARRAY['accepted_by']
    ELSE ARRAY['actor_user_id'] END;
  IF (to_jsonb(NEW) - excluded) IS DISTINCT FROM (to_jsonb(OLD) - excluded) THEN
    RAISE EXCEPTION 'pricing_history_immutable';
  END IF;
  -- Live references may only detach, never be reassigned to another person/item.
  IF EXISTS (SELECT 1 FROM unnest(excluded) AS field
    WHERE field NOT IN ('status','state_revision') AND to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field
      AND to_jsonb(NEW)->field <> 'null'::jsonb) THEN RAISE EXCEPTION 'pricing_reference_immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_rate_history BEFORE UPDATE OR DELETE ON public.gift_pricing_rate_versions FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_preserve_history();
CREATE TRIGGER pricing_quote_history BEFORE UPDATE OR DELETE ON public.gift_price_quotes FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_preserve_history();
CREATE TRIGGER pricing_order_history BEFORE UPDATE OR DELETE ON public.order_pricing_snapshots FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_preserve_history();
CREATE TRIGGER pricing_event_history BEFORE UPDATE OR DELETE ON public.gift_pricing_events FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_preserve_history();

CREATE FUNCTION public.gift_pricing_guard_item() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF (TG_OP = 'INSERT' AND (NEW.active_price_quote_id IS NOT NULL OR NEW.pricing_revision <> 0))
      OR (TG_OP = 'UPDATE' AND (NEW.active_price_quote_id IS DISTINCT FROM OLD.active_price_quote_id OR NEW.pricing_revision <> OLD.pricing_revision)) THEN
      RAISE EXCEPTION 'pricing_fields_server_only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_item_fields BEFORE INSERT OR UPDATE ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_guard_item();

CREATE FUNCTION public.gift_pricing_check_pointer() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item public.wishlist_items; quote public.gift_price_quotes;
BEGIN
  IF TG_TABLE_NAME = 'wishlist_items' THEN
    SELECT * INTO item FROM public.wishlist_items WHERE id = NEW.id;
  ELSE
    SELECT * INTO item FROM public.wishlist_items WHERE active_price_quote_id = NEW.id;
  END IF;
  IF item.active_price_quote_id IS NOT NULL THEN
    SELECT * INTO quote FROM public.gift_price_quotes WHERE id = item.active_price_quote_id;
    IF quote.wishlist_item_id IS DISTINCT FROM item.id OR quote.parent_paid_quote_id IS NOT NULL
      OR quote.item_pricing_revision <> item.pricing_revision THEN RAISE EXCEPTION 'pricing_pointer_mismatch'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER pricing_item_pointer AFTER INSERT OR UPDATE ON public.wishlist_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_check_pointer();
CREATE CONSTRAINT TRIGGER pricing_quote_pointer AFTER UPDATE ON public.gift_price_quotes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gift_pricing_check_pointer();

-- Only authorized server code can call this function. It serializes publication,
-- consumes the preview nonce, and retains the original response for retries.
CREATE FUNCTION public.publish_gift_pricing_rate(
  p_policy_key text, p_rate_bps integer, p_expected_revision integer,
  p_actor_id uuid, p_reason text, p_request_key text, p_request_hash text,
  p_preview_nonce uuid, p_preview_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE policy public.gift_pricing_policies; prior public.gift_pricing_events;
  rate public.gift_pricing_rate_versions; result jsonb; publication_time timestamptz;
BEGIN
  -- Guard actor/operation/key even when concurrent requests name different policies.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':rate_publish:' || p_request_key, 0));
  SELECT * INTO prior FROM public.gift_pricing_events
    WHERE actor_audit_id = p_actor_id::text AND event_type = 'rate_publish' AND request_key = p_request_key;
  IF FOUND THEN
    IF prior.request_hash <> p_request_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN prior.details->'result';
  END IF;
  SELECT * INTO policy FROM public.gift_pricing_policies WHERE key = p_policy_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'policy_not_found'; END IF;
  publication_time := clock_timestamp();
  IF policy.revision <> p_expected_revision THEN RAISE EXCEPTION 'pricing_revision_conflict'; END IF;
  IF p_preview_nonce IS NULL OR p_preview_expires_at IS NULL OR p_preview_expires_at <= publication_time THEN RAISE EXCEPTION 'preview_expired'; END IF;
  IF EXISTS (SELECT 1 FROM public.gift_pricing_events WHERE preview_nonce = p_preview_nonce) THEN RAISE EXCEPTION 'preview_consumed'; END IF;
  INSERT INTO public.gift_pricing_rate_versions(policy_key, version, rate_bps, published_at, published_by, publisher_audit_id, reason)
    VALUES (p_policy_key, policy.revision + 1, p_rate_bps, publication_time, p_actor_id, p_actor_id::text, p_reason) RETURNING * INTO rate;
  UPDATE public.gift_pricing_policies SET active_version_id = rate.id, revision = rate.version, updated_at = publication_time WHERE key = p_policy_key;
  result := jsonb_build_object('version', to_jsonb(rate) - 'published_by', 'revision', rate.version);
  INSERT INTO public.gift_pricing_events(policy_key, actor_user_id, actor_audit_id, actor_kind, event_type, occurred_at, reason, request_key, request_hash, preview_nonce, details)
    VALUES (p_policy_key, p_actor_id, p_actor_id::text, 'admin', 'rate_publish', publication_time, p_reason, p_request_key, p_request_hash, p_preview_nonce, jsonb_build_object('result', result));
  RETURN result;
END;
$$;

ALTER TABLE public.gift_pricing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pricing_rate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pricing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gift_pricing_policies, public.gift_pricing_rate_versions, public.gift_price_quotes,
  public.order_pricing_snapshots, public.gift_pricing_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gift_pricing_policies, public.gift_pricing_rate_versions,
  public.gift_pricing_events TO service_role;
-- Quote and snapshot writes open only with the later owning integrations.
GRANT SELECT ON public.gift_price_quotes, public.order_pricing_snapshots TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.gift_price_quotes, public.order_pricing_snapshots FROM service_role;
REVOKE DELETE, TRUNCATE ON public.gift_pricing_policies, public.gift_pricing_rate_versions, public.gift_pricing_events FROM service_role;
REVOKE ALL ON FUNCTION public.publish_gift_pricing_rate(text, integer, integer, uuid, text, text, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_gift_pricing_rate(text, integer, integer, uuid, text, text, text, uuid, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.gift_pricing_preserve_history(), public.gift_pricing_guard_item(), public.gift_pricing_check_pointer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_pricing_preserve_history(), public.gift_pricing_guard_item(), public.gift_pricing_check_pointer() TO service_role;

COMMIT;
