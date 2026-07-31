-- Migration 015: Reminders — important dates (Flow 1) and real delivery columns.
--
-- Adds the missing delivery-tracking columns the `/api/reminders` cron needs
-- for actual Resend sending with retry/permanently-failed handling, and
-- creates `important_dates` (Flow 1 — "track someone else's occasion")
-- properly since it previously existed live with no migration file backing
-- it and zero application code reading or writing it.

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS days_before integer,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanently_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

CREATE INDEX IF NOT EXISTS reminders_due_idx
  ON public.reminders (scheduled_at)
  WHERE sent = false AND permanently_failed = false;

CREATE TABLE IF NOT EXISTS public.important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  occasion_type text NOT NULL DEFAULT 'other',
  date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT true,
  linked_wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Defensive column patch in case the live table (created outside this repo's
-- migration history) is missing any of these — mirrors the IF NOT EXISTS
-- pattern used throughout this migration set for pre-existing tables.
ALTER TABLE public.important_dates
  ADD COLUMN IF NOT EXISTS person_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS occasion_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS linked_wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.important_dates
  DROP CONSTRAINT IF EXISTS important_dates_occasion_type_check;

ALTER TABLE public.important_dates
  ADD CONSTRAINT important_dates_occasion_type_check
  CHECK (occasion_type IN ('birthday', 'wedding', 'anniversary', 'baby_shower', 'graduation', 'other'))
  NOT VALID;

CREATE INDEX IF NOT EXISTS important_dates_user_id_idx
  ON public.important_dates (user_id);

ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.important_dates TO authenticated;

DROP POLICY IF EXISTS "gifvtme_important_dates_owner_select" ON public.important_dates;
DROP POLICY IF EXISTS "gifvtme_important_dates_owner_insert" ON public.important_dates;
DROP POLICY IF EXISTS "gifvtme_important_dates_owner_update" ON public.important_dates;
DROP POLICY IF EXISTS "gifvtme_important_dates_owner_delete" ON public.important_dates;

CREATE POLICY "gifvtme_important_dates_owner_select"
ON public.important_dates
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "gifvtme_important_dates_owner_insert"
ON public.important_dates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_important_dates_owner_update"
ON public.important_dates
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gifvtme_important_dates_owner_delete"
ON public.important_dates
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
