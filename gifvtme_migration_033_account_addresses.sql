-- Migration 033: Account address book (19_ACCOUNT_MANAGEMENT_SPEC.md)
-- The avatars bucket and owner-scoped storage policies already exist from
-- migration 008; this feature reuses them.

CREATE TABLE IF NOT EXISTS public.addresses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label                 text NOT NULL DEFAULT 'Home',
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  phone                 text,
  street_address        text NOT NULL,
  apt_suite_unit        text,
  city                  text NOT NULL,
  state                 text NOT NULL,
  postal_code           text,
  delivery_instructions text,
  is_default            boolean NOT NULL DEFAULT false,
  is_default_billing    boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS is_default_billing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;

DROP POLICY IF EXISTS "Users manage their own addresses" ON public.addresses;
CREATE POLICY "Users manage their own addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS addresses_user_id_idx
  ON public.addresses (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user_idx
  ON public.addresses (user_id) WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_billing_per_user_idx
  ON public.addresses (user_id) WHERE is_default_billing = true;

DROP TRIGGER IF EXISTS addresses_updated_at ON public.addresses;
CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set one default role atomically. This keeps the unique partial indexes
-- satisfied when the old default is unset and the new one is promoted.
CREATE OR REPLACE FUNCTION public.gifvtme_update_address_defaults(
  target_address_id uuid,
  set_shipping_default boolean,
  set_billing_default boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR (set_shipping_default IS NULL AND set_billing_default IS NULL) THEN
    RETURN false;
  END IF;

  -- Serialize default changes for this user, including when no default row exists yet.
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  PERFORM 1 FROM public.addresses
  WHERE id = target_address_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF set_shipping_default IS TRUE THEN
    UPDATE public.addresses
    SET is_default = false
    WHERE user_id = auth.uid() AND is_default = true AND id <> target_address_id;
  END IF;
  IF set_billing_default IS TRUE THEN
    UPDATE public.addresses
    SET is_default_billing = false
    WHERE user_id = auth.uid() AND is_default_billing = true AND id <> target_address_id;
  END IF;

  UPDATE public.addresses
  SET is_default = COALESCE(set_shipping_default, is_default),
      is_default_billing = COALESCE(set_billing_default, is_default_billing)
  WHERE id = target_address_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_update_address_defaults(uuid, boolean, boolean) TO authenticated;
