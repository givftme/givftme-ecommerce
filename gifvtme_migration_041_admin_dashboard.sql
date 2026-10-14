-- Migration 041: Admin dashboard and event log (23-ADMIN-DASHBOARD-SPEC.md)
--
-- Adds team roles on public.users, the append-only `events` log every admin
-- screen reads from, the `admin_actions` audit trail, `business_enquiries`
-- for the /business brief form, reminder failure triage columns, and the
-- payout reference ops record when they complete a manual transfer.
--
-- The aggregation functions at the end are SECURITY DEFINER and executable by
-- service_role only. The admin screens read through them because PostgREST
-- caps a response at 1,000 rows, so grouping raw rows in application code
-- would silently undercount once the log grows.
--
-- Safe to re-run: every object uses IF NOT EXISTS, OR REPLACE, or a guarded
-- DROP-then-CREATE.
--
-- public.users has no email column; email is read from auth.users.

-- ---------------------------------------------------------------------
-- 1. Team roles
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('support', 'operations', 'growth', 'finance', 'admin'))
  DEFAULT NULL;

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role) WHERE role IS NOT NULL;

-- NULL = customer. A role is granted from the Supabase dashboard (SQL editor
-- or table editor, both privileged) or by the service role. A signed-in
-- customer must never be able to grant themselves one through PostgREST,
-- whatever the table's column grants happen to be.
CREATE OR REPLACE FUNCTION public.gifvtme_guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND NEW.role IS NOT NULL THEN
      RAISE EXCEPTION 'role_change_forbidden';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role_change_forbidden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gifvtme_guard_user_role_trigger ON public.users;
CREATE TRIGGER gifvtme_guard_user_role_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.gifvtme_guard_user_role();

-- The proxy asks "does this session have a role?" without being able to read
-- anyone else's role.
CREATE OR REPLACE FUNCTION public.gifvtme_current_user_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.gifvtme_current_user_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gifvtme_current_user_admin_role() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Event log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  anon_id     TEXT,                    -- anonymous id from first visit, pre-signup
  session_id  TEXT,
  device      TEXT,                    -- 'mobile' | 'desktop' | 'tablet'
  platform    TEXT,                    -- 'web' | 'ios' | 'android'
  city        TEXT,
  country     TEXT        DEFAULT 'NG',
  props       JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_event_idx      ON public.events(event);
CREATE INDEX IF NOT EXISTS events_user_id_idx    ON public.events(user_id);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS events_event_ts_idx   ON public.events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS events_props_idx      ON public.events USING gin(props);

-- Append-only: no UPDATE or DELETE via RLS.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only writes" ON public.events;
CREATE POLICY "Service role only writes" ON public.events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "No updates ever" ON public.events;
CREATE POLICY "No updates ever" ON public.events FOR UPDATE USING (false);
DROP POLICY IF EXISTS "No deletes ever" ON public.events;
CREATE POLICY "No deletes ever" ON public.events FOR DELETE USING (false);
-- Admin reads go through the service role, which bypasses RLS.

-- The INSERT policy above is permissive, so the "service role only" half of
-- its name is enforced by privileges: customers write through /api/events,
-- never straight through PostgREST.
REVOKE ALL ON public.events FROM anon, authenticated;

-- RLS does not bind the service role, so append-only is also enforced here.
-- The one permitted update is the FK's ON DELETE SET NULL when a person's
-- account is deleted: it detaches their rows without rewriting them.
CREATE OR REPLACE FUNCTION public.gifvtme_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.user_id IS NULL
     AND OLD.user_id IS NOT NULL
     AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'events_are_append_only';
END;
$$;

DROP TRIGGER IF EXISTS gifvtme_events_append_only_trigger ON public.events;
CREATE TRIGGER gifvtme_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.gifvtme_events_append_only();

-- ---------------------------------------------------------------------
-- 3. Admin action log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES public.users(id),
  action      TEXT        NOT NULL,   -- 'view_person', 'update_order_status', 'delete_review', etc.
  target_type TEXT,                   -- 'user', 'order', 'review', 'pool', etc.
  target_id   TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_actions_admin_idx  ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON public.admin_actions(target_type, target_id);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_actions FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Business enquiries (from /business page form)
-- ---------------------------------------------------------------------
-- `email` is nullable, unlike the spec's draft: the live /business form
-- accepts an email OR a phone number (lib/business/validation.ts), so a
-- NOT NULL email would drop phone-only leads. The CHECK keeps the same
-- guarantee the form makes: there is always a way to reach the sender.
-- `reference` stores the GXC-XXXX code the form shows the sender, so ops can
-- match a follow-up call to its row.
CREATE TABLE IF NOT EXISTS public.business_enquiries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT        NOT NULL,
  contact_name    TEXT        NOT NULL,
  email           TEXT,
  phone           TEXT,
  occasions       TEXT[]      DEFAULT '{}',
  team_size       TEXT,
  needed_by       DATE,
  notes           TEXT,
  reference       TEXT,
  status          TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  assigned_to     UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_enquiries_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS business_enquiries_status_idx ON public.business_enquiries(status);

ALTER TABLE public.business_enquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_enquiries FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Reminder failure triage
-- ---------------------------------------------------------------------
-- `dismissed` hides a permanently failed reminder from the queue without
-- deleting its history. `last_attempted_at` is stamped by /api/reminders
-- whenever a send attempt fails, so ops can see when it last tried.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS reminders_permanently_failed_idx
  ON public.reminders (scheduled_at)
  WHERE permanently_failed = true AND dismissed = false;

-- ---------------------------------------------------------------------
-- 6. Payout reference
-- ---------------------------------------------------------------------
ALTER TABLE public.pool_payouts ADD COLUMN IF NOT EXISTS reference TEXT;

-- Defensive: the wishlists table predates this repo's migration history, and
-- the admin screens bucket lists by creation date. A no-op where it exists.
ALTER TABLE public.wishlists
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------
-- 7. Events written by the database itself
-- ---------------------------------------------------------------------
-- These fire on every path that creates the row (email signup, Google OAuth,
-- a Retool status change), not just the ones that pass through app code.
-- Analytics must never block a signup or an order update, so each swallows
-- its own failure.

-- user_signed_up: `signup_channel` and `referrer_list_id` are set as user
-- metadata by the signup action; `source` is the auth provider.
CREATE OR REPLACE FUNCTION public.gifvtme_record_user_signed_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user record;
BEGIN
  BEGIN
    SELECT raw_user_meta_data, raw_app_meta_data INTO auth_user
    FROM auth.users WHERE id = NEW.id;

    INSERT INTO public.events (event, user_id, platform, props)
    VALUES (
      'user_signed_up',
      NEW.id,
      'web',
      jsonb_strip_nulls(jsonb_build_object(
        'source', coalesce(auth_user.raw_app_meta_data->>'provider', 'email'),
        'channel', auth_user.raw_user_meta_data->>'signup_channel',
        'city', auth_user.raw_user_meta_data->>'signup_city',
        'referrer_list_id', auth_user.raw_user_meta_data->>'referrer_list_id'
      ))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'user_signed_up event was not recorded: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gifvtme_record_user_signed_up_trigger ON public.users;
CREATE TRIGGER gifvtme_record_user_signed_up_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.gifvtme_record_user_signed_up();

-- order_delivered: `on_time` is null when no delivery estimate was set.
CREATE OR REPLACE FUNCTION public.gifvtme_record_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delivered_on date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  BEGIN
    INSERT INTO public.events (event, user_id, props)
    VALUES (
      'order_delivered',
      NEW.buyer_id,
      jsonb_build_object(
        'order_id', NEW.id,
        'on_time', CASE WHEN NEW.estimated_delivery IS NULL THEN NULL
                        ELSE delivered_on <= NEW.estimated_delivery END,
        'area', coalesce(NEW.shipping_city, NEW.shipping_state),
        'days_from_placed', delivered_on - (NEW.created_at AT TIME ZONE 'Africa/Lagos')::date
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'order_delivered event was not recorded: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gifvtme_record_order_delivered_trigger ON public.orders;
CREATE TRIGGER gifvtme_record_order_delivered_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION public.gifvtme_record_order_delivered();

REVOKE ALL ON FUNCTION public.gifvtme_record_user_signed_up() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gifvtme_record_order_delivered() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Admin read functions (service role only)
-- ---------------------------------------------------------------------
-- "Paid" means the order reached `confirmed`: Flutterwave captured the money.
-- Days are Lagos calendar days.

-- Pulse: eight days of KPI counts (today plus the seven before it, enough for
-- today, yesterday, and a seven-day sparkline) and the operations strip.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  start_at timestamptz := (today - 7)::timestamp AT TIME ZONE 'Africa/Lagos';
  today_start timestamptz := today::timestamp AT TIME ZONE 'Africa/Lagos';
  series jsonb;
  operations jsonb;
BEGIN
  WITH days AS (
    SELECT (today - offs) AS day FROM generate_series(0, 7) AS offs
  ),
  signups AS (
    SELECT (au.created_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*) AS n
    FROM auth.users au JOIN public.users u ON u.id = au.id
    WHERE au.created_at >= start_at GROUP BY 1
  ),
  active AS (
    SELECT (created_at AT TIME ZONE 'Africa/Lagos')::date AS day,
      count(DISTINCT coalesce(user_id::text, anon_id)) AS n
    FROM public.events
    WHERE created_at >= start_at AND event <> 'admin_action'
      AND (user_id IS NOT NULL OR anon_id IS NOT NULL)
    GROUP BY 1
  ),
  dates_saved AS (
    SELECT (created_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*) AS n
    FROM public.important_dates WHERE created_at >= start_at GROUP BY 1
  ),
  lists AS (
    SELECT (created_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*) AS n
    FROM public.wishlists WHERE created_at >= start_at GROUP BY 1
  ),
  shares AS (
    SELECT (created_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*) AS n
    FROM public.events WHERE event = 'wishlist_shared' AND created_at >= start_at GROUP BY 1
  ),
  paid_orders AS (
    SELECT h.order_id, min(h.changed_at) AS paid_at, max(o.total_amount) AS total_amount
    FROM public.order_status_history h JOIN public.orders o ON o.id = h.order_id
    WHERE h.status = 'confirmed'
    GROUP BY h.order_id
    HAVING min(h.changed_at) >= start_at
  ),
  orders_by_day AS (
    SELECT (paid_at AT TIME ZONE 'Africa/Lagos')::date AS day, count(*) AS n, sum(total_amount) AS amount
    FROM paid_orders GROUP BY 1
  ),
  pools_by_day AS (
    SELECT (paid_at AT TIME ZONE 'Africa/Lagos')::date AS day, sum(amount) AS amount
    FROM public.pool_contributions WHERE status = 'paid' AND paid_at >= start_at GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
      'day', d.day,
      'signups', coalesce(s.n, 0),
      'active', coalesce(a.n, 0),
      'dates_saved', coalesce(ds.n, 0),
      'lists_created', coalesce(l.n, 0),
      'links_shared', coalesce(sh.n, 0),
      'orders_placed', coalesce(o.n, 0),
      'collected', coalesce(o.amount, 0) + coalesce(p.amount, 0)
    ) ORDER BY d.day)
  INTO series
  FROM days d
  LEFT JOIN signups s ON s.day = d.day
  LEFT JOIN active a ON a.day = d.day
  LEFT JOIN dates_saved ds ON ds.day = d.day
  LEFT JOIN lists l ON l.day = d.day
  LEFT JOIN shares sh ON sh.day = d.day
  LEFT JOIN orders_by_day o ON o.day = d.day
  LEFT JOIN pools_by_day p ON p.day = d.day;

  SELECT jsonb_build_object(
    'due_today', (SELECT count(*) FROM public.orders
      WHERE estimated_delivery = today
        AND status IN ('confirmed', 'under_review', 'forwarded', 'shipped')),
    'out_for_delivery', (SELECT count(*) FROM public.orders WHERE status = 'shipped'),
    'delivered_today', (SELECT count(DISTINCT order_id) FROM public.order_status_history
      WHERE status = 'delivered' AND changed_at >= today_start),
    'late', (SELECT count(*) FROM public.orders
      WHERE estimated_delivery < today
        AND status IN ('confirmed', 'under_review', 'forwarded', 'shipped')),
    -- Cancelled after it had shipped, in the last seven days.
    'failed_deliveries', (SELECT count(DISTINCT h.order_id)
      FROM public.order_status_history h JOIN public.orders o ON o.id = h.order_id
      WHERE h.status = 'cancelled' AND o.status = 'cancelled'
        AND h.changed_at >= now() - interval '7 days'
        AND EXISTS (SELECT 1 FROM public.order_status_history s
                    WHERE s.order_id = h.order_id AND s.status = 'shipped'))
  ) INTO operations;

  RETURN jsonb_build_object('days', coalesce(series, '[]'::jsonb), 'operations', operations);
END;
$$;

-- Activation funnel: each step counts people from the event log.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_activation_funnel()
RETURNS TABLE (
  signed_up bigint,
  saved_one_date bigint,
  saved_three_dates bigint,
  created_wishlist bigint,
  shared_link bigint,
  first_order bigint,
  second_order bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_user AS (
    SELECT e.user_id,
      count(*) FILTER (WHERE e.event = 'date_saved') AS dates,
      count(*) FILTER (WHERE e.event = 'wishlist_created') AS lists,
      count(*) FILTER (WHERE e.event = 'wishlist_shared') AS shares,
      count(*) FILTER (WHERE e.event = 'order_placed') AS orders
    FROM public.events e
    WHERE e.user_id IS NOT NULL
      AND e.event IN ('date_saved', 'wishlist_created', 'wishlist_shared', 'order_placed')
    GROUP BY e.user_id
  )
  SELECT
    (SELECT count(*) FROM public.events WHERE event = 'user_signed_up'),
    count(*) FILTER (WHERE dates >= 1),
    count(*) FILTER (WHERE dates >= 3),
    count(*) FILTER (WHERE lists >= 1),
    count(*) FILTER (WHERE shares >= 1),
    count(*) FILTER (WHERE orders >= 1),
    count(*) FILTER (WHERE orders >= 2)
  FROM per_user;
$$;

-- Cohort retention: signups grouped by ISO week. A person counts as retained
-- at day N when they did anything in the seven days starting N days after
-- signing up. Each percentage only includes cohort members who have reached
-- day N + 7, and is null when none have.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_cohort_retention(p_weeks integer DEFAULT 12)
RETURNS TABLE (
  cohort_week date,
  cohort_size bigint,
  d7 numeric,
  d14 numeric,
  d30 numeric,
  d60 numeric,
  d90 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH signups AS (
    SELECT e.user_id, min(e.created_at) AS signed_up_at
    FROM public.events e
    WHERE e.event = 'user_signed_up' AND e.user_id IS NOT NULL
    GROUP BY e.user_id
  ),
  cohort AS (
    SELECT s.user_id, s.signed_up_at,
      date_trunc('week', s.signed_up_at AT TIME ZONE 'Africa/Lagos')::date AS week
    FROM signups s
    WHERE s.signed_up_at >= date_trunc('week', now()) - make_interval(weeks => greatest(p_weeks, 1))
  ),
  retained AS (
    SELECT c.user_id, c.week, c.signed_up_at,
      bool_or(e.created_at >= c.signed_up_at + interval '7 days'  AND e.created_at < c.signed_up_at + interval '14 days')  AS r7,
      bool_or(e.created_at >= c.signed_up_at + interval '14 days' AND e.created_at < c.signed_up_at + interval '21 days')  AS r14,
      bool_or(e.created_at >= c.signed_up_at + interval '30 days' AND e.created_at < c.signed_up_at + interval '37 days')  AS r30,
      bool_or(e.created_at >= c.signed_up_at + interval '60 days' AND e.created_at < c.signed_up_at + interval '67 days')  AS r60,
      bool_or(e.created_at >= c.signed_up_at + interval '90 days' AND e.created_at < c.signed_up_at + interval '97 days')  AS r90
    FROM cohort c
    LEFT JOIN public.events e
      ON e.user_id = c.user_id
     AND e.event NOT IN ('user_signed_up', 'admin_action')
     AND e.created_at >= c.signed_up_at + interval '7 days'
     AND e.created_at < c.signed_up_at + interval '97 days'
    GROUP BY c.user_id, c.week, c.signed_up_at
  )
  SELECT r.week, count(*),
    round(100.0 * count(*) FILTER (WHERE r.r7)  / nullif(count(*) FILTER (WHERE r.signed_up_at + interval '14 days' <= now()), 0), 1),
    round(100.0 * count(*) FILTER (WHERE r.r14) / nullif(count(*) FILTER (WHERE r.signed_up_at + interval '21 days' <= now()), 0), 1),
    round(100.0 * count(*) FILTER (WHERE r.r30) / nullif(count(*) FILTER (WHERE r.signed_up_at + interval '37 days' <= now()), 0), 1),
    round(100.0 * count(*) FILTER (WHERE r.r60) / nullif(count(*) FILTER (WHERE r.signed_up_at + interval '67 days' <= now()), 0), 1),
    round(100.0 * count(*) FILTER (WHERE r.r90) / nullif(count(*) FILTER (WHERE r.signed_up_at + interval '97 days' <= now()), 0), 1)
  FROM retained r
  GROUP BY r.week
  ORDER BY r.week DESC;
$$;

-- Lifecycle segments. Ids and definitions are mirrored in lib/admin/segments.ts.
-- Team members are never in a segment, and remembrance/sympathy dates never
-- count toward one or appear as anyone's next date (privacy rule 3).
CREATE OR REPLACE FUNCTION public.gifvtme_admin_segment_members(p_segment text)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  phone text,
  city text,
  next_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT u.id, u.full_name, au.email::text AS email, u.phone,
      au.created_at AS signed_up_at
    FROM public.users u JOIN auth.users au ON au.id = u.id
    WHERE u.role IS NULL
  ),
  dates AS (
    SELECT d.user_id, count(*) AS saved,
      min(d.date) FILTER (WHERE d.date >= current_date) AS next_date,
      bool_or(d.date BETWEEN current_date AND current_date + 14) AS soon
    FROM public.important_dates d
    WHERE d.occasion_type NOT IN ('remembrance', 'sympathy')
    GROUP BY d.user_id
  ),
  paid AS (
    SELECT o.buyer_id AS user_id, count(*) AS orders, max(o.created_at) AS last_order_at
    FROM public.orders o
    WHERE o.status IN ('confirmed', 'under_review', 'forwarded', 'shipped', 'delivered')
    GROUP BY o.buyer_id
  ),
  activity AS (
    SELECT e.user_id, max(e.created_at) AS last_seen_at,
      bool_or(e.event = 'wishlist_shared') AS has_shared,
      (array_agg(e.city ORDER BY e.created_at DESC) FILTER (WHERE e.city IS NOT NULL))[1] AS city
    FROM public.events e
    WHERE e.user_id IS NOT NULL AND e.event <> 'admin_action'
    GROUP BY e.user_id
  ),
  lists AS (
    SELECT w.user_id, count(DISTINCT w.id) AS lists
    FROM public.wishlists w
    JOIN public.wishlist_items i ON i.wishlist_id = w.id AND i.status <> 'archived'
    GROUP BY w.user_id
  ),
  pools AS (
    SELECT c.contributor_id AS user_id, count(*) AS contributions
    FROM public.pool_contributions c WHERE c.status = 'paid'
    GROUP BY c.contributor_id
  )
  SELECT p.id, p.full_name, p.email, p.phone, a.city, d.next_date
  FROM people p
  LEFT JOIN dates d ON d.user_id = p.id
  LEFT JOIN paid o ON o.user_id = p.id
  LEFT JOIN activity a ON a.user_id = p.id
  LEFT JOIN lists l ON l.user_id = p.id
  LEFT JOIN pools pc ON pc.user_id = p.id
  WHERE CASE p_segment
    WHEN 'signed_up_no_date' THEN coalesce(d.saved, 0) = 0 AND p.signed_up_at < now() - interval '2 days'
    WHEN 'one_date_saved' THEN coalesce(d.saved, 0) = 1
    WHEN 'planners_no_order' THEN coalesce(d.saved, 0) >= 3 AND coalesce(o.orders, 0) = 0
    WHEN 'date_soon_no_order' THEN coalesce(d.soon, false)
      AND (o.last_order_at IS NULL OR o.last_order_at < now() - interval '30 days')
    WHEN 'list_not_shared' THEN coalesce(l.lists, 0) > 0 AND NOT coalesce(a.has_shared, false)
    WHEN 'one_time_givers' THEN coalesce(o.orders, 0) = 1 AND o.last_order_at < now() - interval '30 days'
    WHEN 'repeat_givers' THEN coalesce(o.orders, 0) >= 2
    WHEN 'dormant' THEN p.signed_up_at < now() - interval '60 days'
      AND (a.last_seen_at IS NULL OR a.last_seen_at < now() - interval '60 days')
    WHEN 'pool_only' THEN coalesce(pc.contributions, 0) > 0 AND coalesce(o.orders, 0) = 0
    ELSE false
  END
  -- The id tiebreak keeps paged exports stable.
  ORDER BY d.next_date NULLS LAST, p.full_name, p.id;
$$;

-- People search by name, email, or phone. LIKE wildcards in the query are
-- matched literally.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_search_people(p_query text, p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  role text,
  signed_up_at timestamptz,
  last_active_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern,
      btrim(coalesce(p_query, '')) = '' AS empty
  ),
  matches AS (
    SELECT u.id, u.full_name, au.email::text AS email, u.phone, u.role,
      au.created_at AS signed_up_at
    FROM public.users u
    JOIN auth.users au ON au.id = u.id
    CROSS JOIN q
    WHERE q.empty
       OR u.full_name ILIKE q.pattern
       OR au.email ILIKE q.pattern
       OR u.phone ILIKE q.pattern
  )
  SELECT m.id, m.full_name, m.email, m.phone,
    (SELECT e.city FROM public.events e
      WHERE e.user_id = m.id AND e.city IS NOT NULL
      ORDER BY e.created_at DESC LIMIT 1),
    m.role, m.signed_up_at,
    (SELECT max(e.created_at) FROM public.events e
      WHERE e.user_id = m.id AND e.event <> 'admin_action') AS last_active_at
  FROM matches m
  ORDER BY last_active_at DESC NULLS LAST, m.signed_up_at DESC
  LIMIT least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- Names and emails for a set of people, by id or by (lower-cased) email.
-- The admin screens use this instead of reading auth.users through the API.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_user_contacts(
  p_ids uuid[] DEFAULT NULL,
  p_emails text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name, au.email::text, u.phone, u.role
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE (p_ids IS NOT NULL AND u.id = ANY (p_ids))
     OR (p_emails IS NOT NULL AND lower(au.email) = ANY (p_emails));
$$;

-- Lead time: days between an order and the occasion it was for. Shared by
-- the Calendar Engine histogram and Money's Planner's Rate.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_lead_time_histogram(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (bucket text, sort_order integer, orders bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lead AS (
    SELECT CASE WHEN e.props->>'lead_time_days' ~ '^-?[0-9]+$'
                THEN (e.props->>'lead_time_days')::integer END AS days
    FROM public.events e
    WHERE e.event = 'order_placed' AND (p_since IS NULL OR e.created_at >= p_since)
  ),
  labelled AS (
    SELECT CASE
      WHEN days IS NULL THEN 6
      WHEN days < 0 THEN 0
      WHEN days <= 2 THEN 1
      WHEN days <= 6 THEN 2
      WHEN days <= 13 THEN 3
      WHEN days <= 29 THEN 4
      ELSE 5
    END AS sort_order
    FROM lead
  ),
  buckets(sort_order, bucket) AS (
    VALUES (0, 'After the date'), (1, '0–2 days'), (2, '3–6 days'), (3, '7–13 days'),
           (4, '14–29 days'), (5, '30+ days'), (6, 'No date linked')
  )
  SELECT b.bucket, b.sort_order, count(l.sort_order)
  FROM buckets b LEFT JOIN labelled l ON l.sort_order = b.sort_order
  GROUP BY b.bucket, b.sort_order
  ORDER BY b.sort_order;
$$;

-- Calendar Engine. A streak is the number of whole months since a person
-- first saved a date or last missed one, whichever is later.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_calendar()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'dates_by_month', coalesce((
      SELECT jsonb_agg(jsonb_build_object('month', s.month, 'occasion_type', s.occasion_type, 'count', s.n)
                       ORDER BY s.month, s.occasion_type)
      FROM (
        SELECT to_char(date_trunc('month', d.created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM') AS month,
          d.occasion_type, count(*) AS n
        FROM public.important_dates d
        WHERE d.created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1, 2
      ) s), '[]'::jsonb),
    'occasion_mix', coalesce((
      SELECT jsonb_agg(jsonb_build_object('occasion_type', s.occasion_type, 'count', s.n) ORDER BY s.n DESC)
      FROM (
        SELECT d.occasion_type, count(*) AS n FROM public.important_dates d GROUP BY 1
      ) s), '[]'::jsonb),
    'reminders', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'channel', r.channel, 'days_before', r.days_before,
          'sent', r.sent, 'opened', r.opened, 'actioned', r.actioned)
        ORDER BY r.channel, r.days_before DESC NULLS LAST)
      FROM (
        SELECT coalesce(e.props->>'channel', 'unknown') AS channel,
          CASE WHEN e.props->>'days_before' ~ '^[0-9]+$' THEN (e.props->>'days_before')::integer END AS days_before,
          count(*) FILTER (WHERE e.event = 'reminder_sent') AS sent,
          count(DISTINCT e.props->>'message_id') FILTER (WHERE e.event = 'reminder_opened') AS opened,
          count(DISTINCT e.props->>'message_id') FILTER (WHERE e.event = 'reminder_actioned') AS actioned
        FROM public.events e
        WHERE e.event IN ('reminder_sent', 'reminder_opened', 'reminder_actioned')
        GROUP BY 1, 2
      ) r), '[]'::jsonb),
    'lead_time', coalesce((
      SELECT jsonb_agg(jsonb_build_object('bucket', h.bucket, 'orders', h.orders) ORDER BY h.sort_order)
      FROM public.gifvtme_admin_lead_time_histogram(NULL) h), '[]'::jsonb),
    'missed_by_month', coalesce((
      SELECT jsonb_agg(jsonb_build_object('month', m.month, 'missed', m.missed, 'recovered', m.recovered)
                       ORDER BY m.month)
      FROM (
        SELECT to_char(date_trunc('month', e.created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM') AS month,
          count(*) FILTER (WHERE e.event = 'date_missed') AS missed,
          count(*) FILTER (WHERE e.event = 'date_recovered') AS recovered
        FROM public.events e
        WHERE e.event IN ('date_missed', 'date_recovered')
          AND e.created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
      ) m), '[]'::jsonb),
    'streaks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', s.full_name, 'months', s.months)
                       ORDER BY s.months DESC, s.first_saved)
      FROM (
        SELECT f.user_id, u.full_name, f.first_saved,
          (extract(year FROM age(now(), greatest(f.first_saved, coalesce(m.last_missed, f.first_saved)))) * 12
            + extract(month FROM age(now(), greatest(f.first_saved, coalesce(m.last_missed, f.first_saved)))))::integer AS months
        FROM (SELECT d.user_id, min(d.created_at) AS first_saved FROM public.important_dates d GROUP BY d.user_id) f
        JOIN public.users u ON u.id = f.user_id AND u.role IS NULL
        LEFT JOIN (
          SELECT e.user_id, max(e.created_at) AS last_missed
          FROM public.events e WHERE e.event = 'date_missed' GROUP BY e.user_id
        ) m ON m.user_id = f.user_id
        ORDER BY months DESC, f.first_saved
        LIMIT 20
      ) s), '[]'::jsonb)
  );
$$;

-- Wishlists & Sharing. Rates are computed by the caller from these counts.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_wishlist_metrics(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lists AS (
    SELECT w.id FROM public.wishlists w WHERE p_since IS NULL OR w.created_at >= p_since
  ),
  items AS (
    SELECT i.id, i.origin, i.price FROM public.wishlist_items i
    WHERE i.status <> 'archived' AND (p_since IS NULL OR i.created_at >= p_since)
  ),
  added AS (
    SELECT DISTINCT ON (e.props->>'item_id') e.props->>'item_id' AS item_id, e.props->>'source' AS source
    FROM public.events e
    WHERE e.event = 'wishlist_item_added' AND e.props ? 'item_id'
    ORDER BY e.props->>'item_id', e.created_at
  ),
  ev AS (
    SELECT e.event, e.props FROM public.events e
    WHERE e.event IN ('wishlist_shared', 'wishlist_opened', 'item_claimed', 'user_signed_up')
      AND (p_since IS NULL OR e.created_at >= p_since)
  )
  SELECT jsonb_build_object(
    'lists_created', (SELECT count(*) FROM lists),
    'avg_items_per_list', (
      SELECT coalesce(round(count(i.id)::numeric / nullif(count(DISTINCT l.id), 0), 1), 0)
      FROM lists l LEFT JOIN public.wishlist_items i ON i.wishlist_id = l.id AND i.status <> 'archived'),
    'items_total', (SELECT count(*) FROM items),
    'items_no_price', (SELECT count(*) FROM items WHERE price IS NULL),
    'source', jsonb_build_object(
      'catalog', (SELECT count(*) FROM items WHERE origin = 'catalog'),
      'external_scraped', (SELECT count(*) FROM items i JOIN added a ON a.item_id = i.id::text
                           WHERE i.origin = 'external' AND a.source = 'scraped'),
      'external_manual', (SELECT count(*) FROM items i JOIN added a ON a.item_id = i.id::text
                          WHERE i.origin = 'external' AND coalesce(a.source, 'manual') <> 'scraped'),
      'external_untracked', (SELECT count(*) FROM items i LEFT JOIN added a ON a.item_id = i.id::text
                             WHERE i.origin = 'external' AND a.item_id IS NULL)
    ),
    'lists_shared', (SELECT count(DISTINCT props->>'wishlist_id') FROM ev WHERE event = 'wishlist_shared'),
    'shares', (SELECT count(*) FROM ev WHERE event = 'wishlist_shared'),
    'opens', (SELECT count(*) FROM ev WHERE event = 'wishlist_opened'),
    'claims', (SELECT count(*) FROM ev WHERE event = 'item_claimed'),
    'attributed_signups', (SELECT count(*) FROM ev
                           WHERE event = 'user_signed_up' AND coalesce(props->>'referrer_list_id', '') <> '')
  );
$$;

CREATE OR REPLACE FUNCTION public.gifvtme_admin_top_shared_wishlists(
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  wishlist_id uuid,
  owner_name text,
  occasion_title text,
  occasion_type text,
  shares bigint,
  claims bigint,
  attributed_signups bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shared AS (
    SELECT e.props->>'wishlist_id' AS wid, count(*) AS n
    FROM public.events e
    WHERE e.event = 'wishlist_shared' AND e.props ? 'wishlist_id'
      AND (p_since IS NULL OR e.created_at >= p_since)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  SELECT w.id, u.full_name, o.title, o.occasion_type, s.n,
    (SELECT count(*) FROM public.events e
      WHERE e.event = 'item_claimed' AND e.props->>'wishlist_id' = s.wid
        AND (p_since IS NULL OR e.created_at >= p_since)),
    (SELECT count(*) FROM public.events e
      WHERE e.event = 'user_signed_up' AND e.props->>'referrer_list_id' = s.wid
        AND (p_since IS NULL OR e.created_at >= p_since))
  FROM shared s
  JOIN public.wishlists w ON w.id::text = s.wid
  LEFT JOIN public.users u ON u.id = w.user_id
  LEFT JOIN public.occasions o ON o.id = w.occasion_id
  ORDER BY s.n DESC;
$$;

-- Demand Intelligence. Lists without an occasion are 'evergreen'.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_demand(
  p_since timestamptz DEFAULT NULL,
  p_occasion text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH items AS (
    SELECT i.id, i.title, i.price, i.origin, i.product_url, i.status, w.user_id,
      coalesce(o.occasion_type, 'evergreen') AS occasion_type
    FROM public.wishlist_items i
    JOIN public.wishlists w ON w.id = i.wishlist_id
    LEFT JOIN public.occasions o ON o.id = w.occasion_id
    WHERE i.status <> 'archived'
      AND (p_since IS NULL OR i.created_at >= p_since)
      AND (p_occasion IS NULL OR coalesce(o.occasion_type, 'evergreen') = p_occasion)
  ),
  owner_city AS (
    SELECT DISTINCT ON (e.user_id) e.user_id, e.city
    FROM public.events e
    WHERE e.user_id IS NOT NULL AND e.city IS NOT NULL
    ORDER BY e.user_id, e.created_at DESC
  ),
  searches AS (
    SELECT lower(btrim(e.props->>'query')) AS query,
      CASE WHEN e.props->>'result_count' ~ '^[0-9]+$' THEN (e.props->>'result_count')::integer END AS result_count
    FROM public.events e
    WHERE e.event = 'search_performed'
      AND coalesce(btrim(e.props->>'query'), '') <> ''
      AND (p_since IS NULL OR e.created_at >= p_since)
  )
  SELECT jsonb_build_object(
    'top_items', coalesce((
      SELECT jsonb_agg(t ORDER BY t.wishes DESC, t.title)
      FROM (
        SELECT min(i.title) AS title, count(*) AS wishes, round(avg(i.price)) AS avg_price,
          mode() WITHIN GROUP (ORDER BY i.occasion_type) AS top_occasion,
          mode() WITHIN GROUP (ORDER BY c.city) AS top_city
        FROM items i LEFT JOIN owner_city c ON c.user_id = i.user_id
        GROUP BY lower(btrim(i.title))
        ORDER BY count(*) DESC, min(i.title)
        LIMIT 25
      ) t), '[]'::jsonb),
    'searches', coalesce((
      SELECT jsonb_agg(t ORDER BY t.searches DESC, t.query)
      FROM (
        SELECT s.query, count(*) AS searches,
          count(*) FILTER (WHERE s.result_count > 0) AS with_results,
          count(*) FILTER (WHERE s.result_count = 0) AS zero_results
        FROM searches s GROUP BY s.query
        ORDER BY count(*) DESC, s.query
        LIMIT 25
      ) t), '[]'::jsonb),
    'zero_results', coalesce((
      SELECT jsonb_agg(t ORDER BY t.searches DESC, t.query)
      FROM (
        SELECT s.query, count(*) AS searches
        FROM searches s WHERE s.result_count = 0 GROUP BY s.query
        ORDER BY count(*) DESC, s.query
        LIMIT 25
      ) t), '[]'::jsonb),
    'domains', coalesce((
      SELECT jsonb_agg(t ORDER BY t.items DESC, t.domain)
      FROM (
        SELECT lower(substring(i.product_url FROM '^[A-Za-z][A-Za-z0-9+.-]*://(?:www\.)?([^/:?#]+)')) AS domain,
          count(*) AS items
        FROM items i
        WHERE i.origin = 'external' AND i.product_url IS NOT NULL
        GROUP BY 1
        HAVING lower(substring(i.product_url FROM '^[A-Za-z][A-Za-z0-9+.-]*://(?:www\.)?([^/:?#]+)')) IS NOT NULL
        ORDER BY count(*) DESC
        LIMIT 25
      ) t), '[]'::jsonb),
    'gap', coalesce((
      SELECT jsonb_agg(t ORDER BY t.wanted DESC, t.category)
      FROM (
        SELECT coalesce(nullif(btrim(a.props->>'category'), ''), 'Uncategorised') AS category,
          count(*) AS wanted,
          count(*) FILTER (WHERE i.status = 'purchased') AS bought
        FROM public.events a
        JOIN items i ON i.id::text = a.props->>'item_id'
        WHERE a.event = 'wishlist_item_added'
        GROUP BY 1
      ) t), '[]'::jsonb)
  );
$$;

-- Diaspora: orders whose giver was last seen outside Nigeria.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_diaspora(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH placed AS (
    SELECT DISTINCT ON (o.id) e.country, e.user_id, o.id AS order_id, o.total_amount,
      coalesce(o.shipping_state, o.shipping_city, 'Unknown') AS receiver_area,
      coalesce(oc.occasion_type, 'no occasion') AS occasion_type
    FROM public.events e
    JOIN public.orders o ON o.id::text = e.props->>'order_id'
    LEFT JOIN public.wishlist_items i ON i.id = o.wishlist_item_id
    LEFT JOIN public.wishlists w ON w.id = i.wishlist_id
    LEFT JOIN public.occasions oc ON oc.id = w.occasion_id
    WHERE e.event = 'order_placed'
      AND e.country IS NOT NULL AND upper(e.country) <> 'NG'
      AND (p_since IS NULL OR e.created_at >= p_since)
    ORDER BY o.id, e.created_at
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object('orders', count(*), 'value', coalesce(sum(total_amount), 0),
                                         'givers', count(DISTINCT user_id)) FROM placed),
    'countries', coalesce((
      SELECT jsonb_agg(t ORDER BY t.value DESC)
      FROM (SELECT upper(country) AS country, count(*) AS orders, sum(total_amount) AS value,
              count(DISTINCT user_id) AS givers
            FROM placed GROUP BY 1) t), '[]'::jsonb),
    'receivers', coalesce((
      SELECT jsonb_agg(t ORDER BY t.orders DESC)
      FROM (SELECT receiver_area AS area, count(*) AS orders, sum(total_amount) AS value
            FROM placed GROUP BY 1) t), '[]'::jsonb),
    'occasions', coalesce((
      SELECT jsonb_agg(t ORDER BY t.orders DESC)
      FROM (SELECT occasion_type, count(*) AS orders FROM placed GROUP BY 1) t), '[]'::jsonb)
  );
$$;

-- Money: catalog revenue, a 30-day rolling average order value, and refunds.
CREATE OR REPLACE FUNCTION public.gifvtme_admin_money(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH paid AS (
    SELECT o.id, o.status, max(o.total_amount) AS total_amount, min(h.changed_at) AS paid_at
    FROM public.orders o
    JOIN public.order_status_history h ON h.order_id = o.id AND h.status = 'confirmed'
    GROUP BY o.id, o.status
  ),
  refunds AS (
    SELECT o.id, o.total_amount, h.changed_at AS refunded_at, h.notes AS reason
    FROM public.orders o
    JOIN LATERAL (
      SELECT hh.changed_at, hh.notes FROM public.order_status_history hh
      WHERE hh.order_id = o.id AND hh.status = 'refunded'
      ORDER BY hh.changed_at DESC LIMIT 1
    ) h ON true
    WHERE o.status = 'refunded' AND (p_since IS NULL OR h.changed_at >= p_since)
  )
  SELECT jsonb_build_object(
    'catalog', (SELECT jsonb_build_object('orders', count(*), 'gross', coalesce(sum(total_amount), 0))
                FROM paid WHERE p_since IS NULL OR paid_at >= p_since),
    'pool_funds', (SELECT coalesce(sum(amount), 0) FROM public.pool_contributions
                   WHERE status = 'paid' AND (p_since IS NULL OR paid_at >= p_since)),
    'refunded_total', (SELECT coalesce(sum(total_amount), 0) FROM refunds),
    'aov_trend', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'aov', d.aov) ORDER BY d.day)
      FROM (
        SELECT g.day,
          (SELECT round(avg(p.total_amount)) FROM paid p
            WHERE p.paid_at >= (g.day - 29)::timestamp AT TIME ZONE 'Africa/Lagos'
              AND p.paid_at < (g.day + 1)::timestamp AT TIME ZONE 'Africa/Lagos') AS aov
        FROM (SELECT ((now() AT TIME ZONE 'Africa/Lagos')::date - offs) AS day
              FROM generate_series(0, 89) AS offs) g
      ) d), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'order_id', r.id, 'amount', r.total_amount, 'refunded_at', r.refunded_at, 'reason', r.reason,
          'approved_by', (
            SELECT u.full_name FROM public.admin_actions a JOIN public.users u ON u.id = a.admin_id
            WHERE a.action = 'update_order_status' AND a.target_type = 'order'
              AND a.target_id = r.id::text AND a.metadata->>'to' = 'refunded'
            ORDER BY a.created_at DESC LIMIT 1))
        ORDER BY r.refunded_at DESC)
      FROM refunds r), '[]'::jsonb)
  );
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.gifvtme_admin_pulse()',
    'public.gifvtme_admin_activation_funnel()',
    'public.gifvtme_admin_cohort_retention(integer)',
    'public.gifvtme_admin_segment_members(text)',
    'public.gifvtme_admin_search_people(text, integer)',
    'public.gifvtme_admin_user_contacts(uuid[], text[])',
    'public.gifvtme_admin_lead_time_histogram(timestamptz)',
    'public.gifvtme_admin_calendar()',
    'public.gifvtme_admin_wishlist_metrics(timestamptz)',
    'public.gifvtme_admin_top_shared_wishlists(timestamptz, integer)',
    'public.gifvtme_admin_demand(timestamptz, text)',
    'public.gifvtme_admin_diaspora(timestamptz)',
    'public.gifvtme_admin_money(timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;
