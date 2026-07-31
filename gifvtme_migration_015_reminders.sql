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
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Lets the cron atomically claim a reminder (conditional UPDATE ... WHERE
-- claimed_at IS NULL OR claimed_at < staleThreshold) before sending, so two
-- overlapping cron invocations can't both send the same reminder. A claim
-- older than the cron's own staleness window is treated as abandoned (e.g.
-- the previous invocation crashed or timed out) and can be re-claimed.
CREATE INDEX IF NOT EXISTS reminders_claimed_at_idx
  ON public.reminders (claimed_at)
  WHERE sent = false AND permanently_failed = false;

-- Set alongside `sent=true` for a recurring important date's 3-day reminder.
-- The email send and the date-advance/reschedule are two separate steps that
-- can't share one transaction (the advance happens via a follow-up Supabase
-- call, not the same statement), so this flag is what lets the cron retry
-- just the advance on a later run without re-sending the email.
CREATE INDEX IF NOT EXISTS reminders_advance_pending_idx
  ON public.reminders (advance_pending)
  WHERE advance_pending = true;

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

-- reminders.important_date_id predates this repo's migration history, so its
-- FK's ON DELETE behavior (if it even has one) is unverifiable from the code.
-- Deleting an important date only ever explicitly removed its *unsent*
-- reminders — any sent ones (which exist for the common case of a date
-- that's fired at least one reminder already) still reference the row, so an
-- unknown/absent ON DELETE policy could reject the DELETE outright with a
-- foreign-key violation. Made explicit here: CASCADE, so deleting an
-- important date always succeeds and removes every reminder that pointed at
-- it (sent or unsent) in the same statement — no separate app-side delete or
-- transaction needed.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'reminders'
      AND con.contype = 'f'
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS colnum
        JOIN pg_attribute attr
          ON attr.attrelid = con.conrelid AND attr.attnum = colnum
        WHERE attr.attname = 'important_date_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_important_date_id_fkey
  FOREIGN KEY (important_date_id)
  REFERENCES public.important_dates(id)
  ON DELETE CASCADE
  NOT VALID;

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
