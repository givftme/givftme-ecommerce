-- Migration 009: Occasion reactivation prompts.
-- Persists a dashboard-wide nudge when an occasion archives with purchased
-- evergreen items, so the reactivation choice isn't only discoverable by
-- reopening that specific occasion's detail page.

CREATE TABLE IF NOT EXISTS public.occasion_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  occasion_id uuid NOT NULL REFERENCES public.occasions(id) ON DELETE CASCADE,
  prompt_type text NOT NULL DEFAULT 'reactivation',
  payload jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS occasion_prompts_user_unresolved_idx
  ON public.occasion_prompts (user_id)
  WHERE resolved_at IS NULL;

-- At most one open reactivation prompt per occasion at a time — both the
-- manual archive route and the daily cron attempt to create one, and this
-- makes that a harmless no-op (23505) on the second attempt.
CREATE UNIQUE INDEX IF NOT EXISTS occasion_prompts_occasion_unresolved_unique_idx
  ON public.occasion_prompts (occasion_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.occasion_prompts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.occasion_prompts TO authenticated;

CREATE POLICY "gifvtme_occasion_prompts_owner_select"
ON public.occasion_prompts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "gifvtme_occasion_prompts_owner_insert"
ON public.occasion_prompts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_occasion_prompts_owner_update"
ON public.occasion_prompts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
