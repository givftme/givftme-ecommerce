-- Migration 008: Profile Management
-- Adds the users.phone column, extends the UPDATE column grant so authenticated
-- users can update avatar_url/phone on their own row, adds an owner-scoped RPC
-- for reading phone (see below for why a plain SELECT grant isn't safe here),
-- and creates the public `avatars` Storage bucket with owner-folder policies.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text;

-- No blanket GRANT SELECT (phone) here: "gifvtme_users_select_allowed_profiles"
-- (migration 004) also admits a user's purchase/gift counterparty via
-- gifvtme_can_read_profile(), not just the row owner. A column grant applies to
-- every row that policy admits, so granting SELECT(phone) to `authenticated`
-- would let a buyer/receiver read each other's phone number. Instead, phone is
-- only readable through the owner-scoped function below.
GRANT UPDATE (avatar_url, phone) ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.gifvtme_get_own_phone()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT phone FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_get_own_phone() TO authenticated;

-- Storage bucket: avatars (public read, since avatars render in shared
-- wishlist headers and other giver-facing contexts).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS gifvtme_avatars_public_read ON storage.objects;
CREATE POLICY gifvtme_avatars_public_read
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS gifvtme_avatars_owner_write ON storage.objects;
CREATE POLICY gifvtme_avatars_owner_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS gifvtme_avatars_owner_update ON storage.objects;
CREATE POLICY gifvtme_avatars_owner_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS gifvtme_avatars_owner_delete ON storage.objects;
CREATE POLICY gifvtme_avatars_owner_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
