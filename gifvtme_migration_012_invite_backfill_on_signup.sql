-- Migration 012: Backfill wishlist_invites.invitee_user_id at signup time.
--
-- gifvtme_accept_wishlist_invite / gifvtme_opt_in_wishlist_invite already
-- backfill invitee_user_id on-demand (invite-accept / reminder opt-in time).
-- This migration adds the signup-time case from 07-WISHLIST-SHARING.md: an
-- invited person who signs up before ever visiting their invite link should
-- still show as matched. Implemented as a standalone trigger on auth.users
-- rather than editing handle_new_user, whose current body isn't checked into
-- this repo (migration 001 was applied directly to Supabase and never
-- committed) — safer to add a second trigger than to blind-rewrite an
-- unknown function.

CREATE OR REPLACE FUNCTION public.gifvtme_backfill_invitee_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wishlist_invites
  SET invitee_user_id = NEW.id
  WHERE invitee_user_id IS NULL
    AND invitee_email IS NOT NULL
    AND NEW.email IS NOT NULL
    AND lower(invitee_email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gifvtme_backfill_invitee_on_signup_trigger ON auth.users;

CREATE TRIGGER gifvtme_backfill_invitee_on_signup_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.gifvtme_backfill_invitee_on_signup();
