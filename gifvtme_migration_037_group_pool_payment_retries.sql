-- Migration 037: persist group-pool hosted payment links so an idempotent
-- contribution retry can resume the same Flutterwave checkout.

BEGIN;

ALTER TABLE public.pool_contributions
  ADD COLUMN IF NOT EXISTS flutterwave_payment_link text,
  ADD COLUMN IF NOT EXISTS payment_claimed_at timestamptz;

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
  SET status = 'failed', payment_claimed_at = NULL, updated_at = now()
  WHERE id = p_contribution_id AND status = 'pending_payment';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN jsonb_build_object('failed', updated_rows = 1);
END;
$$;

REVOKE ALL ON FUNCTION public.gifvtme_fail_group_pool_contribution(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_fail_group_pool_contribution(uuid)
  TO service_role;

COMMIT;
