-- Migration 008: Profile Management
-- Adds the users.phone column, extends column-level grants so authenticated
-- users can read/update avatar_url and phone on their own row, and creates
-- the public `avatars` Storage bucket with owner-folder write policies.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text;

-- phone is intentionally not granted to anon: unlike full_name/avatar_url it
-- is never displayed in a shared/giver-facing context in v1.
GRANT SELECT (phone) ON public.users TO authenticated;
GRANT UPDATE (avatar_url, phone) ON public.users TO authenticated;

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
