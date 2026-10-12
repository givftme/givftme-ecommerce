-- Migration 038: persist and retry contributor notices after a group-pool
-- cash-out. The queue row is created in the same transaction as the paid_out
-- transition so an email outage cannot lose the notification.

BEGIN;

CREATE TABLE IF NOT EXISTS public.group_gift_pool_cashout_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.group_gift_pools(id) ON DELETE RESTRICT,
  contribution_id uuid NOT NULL REFERENCES public.pool_contributions(id) ON DELETE RESTRICT,
  contributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, contributor_id)
);

CREATE INDEX IF NOT EXISTS group_gift_pool_cashout_notifications_pending_idx
  ON public.group_gift_pool_cashout_notifications(next_attempt_at, created_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.group_gift_pool_cashout_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.group_gift_pool_cashout_notifications
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.group_gift_pool_cashout_notifications
  TO service_role;

CREATE OR REPLACE FUNCTION public.gifvtme_queue_group_pool_cashout_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_gift_pool_cashout_notifications (
    pool_id, contribution_id, contributor_id
  )
  SELECT NEW.id, first_contribution.id, first_contribution.contributor_id
  FROM (
    SELECT DISTINCT ON (contribution.contributor_id)
      contribution.id, contribution.contributor_id
    FROM public.pool_contributions contribution
    WHERE contribution.pool_id = NEW.id
      AND contribution.status = 'paid'
      AND contribution.applied_to_pool
    ORDER BY contribution.contributor_id, contribution.created_at, contribution.id
  ) first_contribution
  ON CONFLICT (pool_id, contributor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_gift_pools_queue_cashout_notifications
  ON public.group_gift_pools;
CREATE TRIGGER group_gift_pools_queue_cashout_notifications
AFTER UPDATE OF status ON public.group_gift_pools
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'paid_out' AND NEW.status = 'paid_out')
EXECUTE FUNCTION public.gifvtme_queue_group_pool_cashout_notifications();

REVOKE ALL ON FUNCTION public.gifvtme_queue_group_pool_cashout_notifications()
  FROM PUBLIC, anon, authenticated;

COMMIT;
