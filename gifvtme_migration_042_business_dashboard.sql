-- Migration 042: Givftme for Business — HR dashboard (24-BUSINESS-DASHBOARD-SPEC.md)
--
-- Company accounts for /business-dashboard: the account, its HR users, the
-- staff and clients whose days it tracks, gifting campaigns, automatic rules,
-- and proof-of-delivery records. Business users are ordinary auth users whose
-- public.users row has account_type = 'business'.
--
-- Every dashboard read and write goes through the service role from server
-- code that first checks business_users membership and the member's role
-- (lib/business-dashboard/). Members may also SELECT their own account's rows
-- through RLS; nobody writes through PostgREST, because the permission matrix
-- (admin / editor / approver / limited) lives in application code.
--
-- Safe to re-run: every object uses IF NOT EXISTS, OR REPLACE, or a guarded
-- DROP-then-CREATE.

-- ---------------------------------------------------------------------
-- 1. Account type on public.users
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT
  NOT NULL DEFAULT 'consumer'
  CHECK (account_type IN ('consumer', 'business'));

-- The proxy asks "is this session a business account?" without being able to
-- read the column itself (authenticated has column-level SELECT only).
CREATE OR REPLACE FUNCTION public.gifvtme_current_user_account_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.gifvtme_current_user_account_type() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gifvtme_current_user_account_type() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- Business account (one per company)
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT        NOT NULL,
  brand_color      TEXT        NOT NULL DEFAULT '#C40404',
  logo_url         TEXT,
  default_message  TEXT        NOT NULL DEFAULT 'Thank you for everything you do.',
  plan             TEXT        NOT NULL DEFAULT 'Pulse'
                   CHECK (plan IN ('Pulse','Seasons','Signature')),
  annual_budget    NUMERIC     NOT NULL DEFAULT 0,
  budget_used      NUMERIC     NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC     NOT NULL DEFAULT 2500,
  per_head_default NUMERIC     NOT NULL DEFAULT 18000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Who gets the reminders" (Automatic rules screen). The spec's
-- saveReminderSettings() updates "business_accounts notification prefs";
-- these are those columns.
ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS reminder_contact    TEXT,
  ADD COLUMN IF NOT EXISTS reminder_cc_email   TEXT,
  ADD COLUMN IF NOT EXISTS reminder_channel    TEXT NOT NULL DEFAULT 'WhatsApp and email',
  ADD COLUMN IF NOT EXISTS auto_approve_under  NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_accounts_reminder_channel_check'
  ) THEN
    ALTER TABLE public.business_accounts
      ADD CONSTRAINT business_accounts_reminder_channel_check
      CHECK (reminder_channel IN ('WhatsApp and email', 'Email only', 'WhatsApp only'));
  END IF;
END;
$$;

-- Business dashboard users (HR team members)
CREATE TABLE IF NOT EXISTS public.business_users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID        NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL DEFAULT 'editor'
                    CHECK (role IN ('admin','editor','approver','limited')),
  department        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, user_id)
);
CREATE INDEX IF NOT EXISTS business_users_user_idx ON public.business_users(user_id);

-- Staff and clients tracked by the company
CREATE TABLE IF NOT EXISTS public.business_people (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  kind          TEXT        NOT NULL CHECK (kind IN ('staff','client')),
  name          TEXT        NOT NULL,
  department    TEXT,
  role_title    TEXT,
  bday          TEXT        NOT NULL, -- 'MM-DD' format
  start_date    DATE,                 -- for work anniversary milestones (staff only)
  company       TEXT,                 -- client's company (client only)
  relationship  TEXT,                 -- Client / Partner / Vendor / Board (client only)
  account_owner TEXT,                 -- client account owner name (client only)
  tier          TEXT        NOT NULL DEFAULT 'Standard'
                CHECK (tier IN ('Standard','Premium','Signature')),
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_people_account_idx ON public.business_people(account_id);
CREATE INDEX IF NOT EXISTS business_people_bday_idx    ON public.business_people(bday);

-- Gifting campaigns
CREATE TABLE IF NOT EXISTS public.business_campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  occasion      TEXT        NOT NULL,
  audience      TEXT        NOT NULL,
  heads         INTEGER     NOT NULL DEFAULT 1,
  per_head      NUMERIC     NOT NULL DEFAULT 18000,
  delivery_fee  NUMERIC     NOT NULL DEFAULT 2500,
  delivery_date DATE        NOT NULL,
  gift_type     TEXT        NOT NULL,
  card_message  TEXT,
  status        TEXT        NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft','Pending approval','Approved','Delivered')),
  owner         TEXT,
  linked_order_id UUID      REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_campaigns_account_idx ON public.business_campaigns(account_id);
CREATE INDEX IF NOT EXISTS business_campaigns_status_idx  ON public.business_campaigns(status);

-- Automatic gifting rules per company
CREATE TABLE IF NOT EXISTS public.business_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  rule_key    TEXT        NOT NULL,  -- 'staff_birthdays', 'work_anniversaries', etc.
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, rule_key)
);

-- Proof of delivery records (written by ops from Retool / the service role)
CREATE TABLE IF NOT EXISTS public.business_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  campaign_id     UUID        REFERENCES public.business_campaigns(id) ON DELETE SET NULL,
  recipient_name  TEXT        NOT NULL,
  recipient_group TEXT,
  occasion        TEXT,
  gift_type       TEXT,
  photo_url       TEXT,
  delivered_at    TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','delivered','failed','rebooked')),
  exception_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_deliveries_account_idx ON public.business_deliveries(account_id);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.business_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_people     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_deliveries ENABLE ROW LEVEL SECURITY;

-- Membership check used by every read policy. SECURITY DEFINER so the
-- business_users policy can call it without recursing into itself.
CREATE OR REPLACE FUNCTION public.gifvtme_is_business_member(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE account_id = p_account_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.gifvtme_is_business_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gifvtme_is_business_member(uuid) TO authenticated, service_role;

REVOKE ALL ON public.business_accounts   FROM anon, authenticated;
REVOKE ALL ON public.business_users      FROM anon, authenticated;
REVOKE ALL ON public.business_people     FROM anon, authenticated;
REVOKE ALL ON public.business_campaigns  FROM anon, authenticated;
REVOKE ALL ON public.business_rules      FROM anon, authenticated;
REVOKE ALL ON public.business_deliveries FROM anon, authenticated;

GRANT SELECT ON public.business_accounts   TO authenticated;
GRANT SELECT ON public.business_users      TO authenticated;
GRANT SELECT ON public.business_people     TO authenticated;
GRANT SELECT ON public.business_campaigns  TO authenticated;
GRANT SELECT ON public.business_rules      TO authenticated;
GRANT SELECT ON public.business_deliveries TO authenticated;

DROP POLICY IF EXISTS "Members read their account" ON public.business_accounts;
CREATE POLICY "Members read their account" ON public.business_accounts
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(id));

DROP POLICY IF EXISTS "Members read their team" ON public.business_users;
CREATE POLICY "Members read their team" ON public.business_users
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(account_id));

DROP POLICY IF EXISTS "Members read their people" ON public.business_people;
CREATE POLICY "Members read their people" ON public.business_people
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(account_id));

DROP POLICY IF EXISTS "Members read their campaigns" ON public.business_campaigns;
CREATE POLICY "Members read their campaigns" ON public.business_campaigns
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(account_id));

DROP POLICY IF EXISTS "Members read their rules" ON public.business_rules;
CREATE POLICY "Members read their rules" ON public.business_rules
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(account_id));

DROP POLICY IF EXISTS "Members read their deliveries" ON public.business_deliveries;
CREATE POLICY "Members read their deliveries" ON public.business_deliveries
  FOR SELECT TO authenticated USING (public.gifvtme_is_business_member(account_id));

-- ---------------------------------------------------------------------
-- 4. Account creation (service role only)
-- ---------------------------------------------------------------------
-- One transaction: flag the user as a business account, create the company,
-- link the user as its admin, and seed the six automatic rules with their
-- defaults. The signup route deletes the auth user if this raises, so a
-- failed signup leaves nothing behind.
CREATE OR REPLACE FUNCTION public.gifvtme_create_business_account(
  p_user_id      uuid,
  p_company_name text,
  p_department   text,
  p_full_name    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
BEGIN
  IF coalesce(trim(p_company_name), '') = '' THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  -- handle_new_user normally creates the profile row on auth signup; insert
  -- it here only if that trigger hasn't.
  UPDATE public.users SET account_type = 'business' WHERE id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.users (id, full_name, account_type)
    VALUES (p_user_id, p_full_name, 'business');
  END IF;

  INSERT INTO public.business_accounts (company_name)
  VALUES (trim(p_company_name))
  RETURNING id INTO new_account_id;

  INSERT INTO public.business_users (account_id, user_id, role, department)
  VALUES (new_account_id, p_user_id, 'admin', nullif(trim(coalesce(p_department, '')), ''));

  INSERT INTO public.business_rules (account_id, rule_key, enabled)
  VALUES
    (new_account_id, 'staff_birthdays',      true),
    (new_account_id, 'work_anniversaries',   true),
    (new_account_id, 'babies_weddings',      false),
    (new_account_id, 'client_birthdays',     true),
    (new_account_id, 'sympathy',             true),
    (new_account_id, 'quiet_month_reminder', true)
  ON CONFLICT (account_id, rule_key) DO NOTHING;

  RETURN new_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gifvtme_create_business_account(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gifvtme_create_business_account(uuid, text, text, text) TO service_role;
