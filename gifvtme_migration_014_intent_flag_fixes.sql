-- Fixes gifvtme_flag_wishlist_item_intent (introduced in migration 006):
--
-- 1. It never allowed a second giver to flag intent once any flag existed,
--    regardless of age — contradicting the 24h expiring last-write-wins
--    signal the feature spec (and the app's own read-time expiry logic in
--    lib/wishlist/shared.ts) describe. It's now expiry-aware: a flag older
--    than 24h, or held by the caller themselves, no longer blocks a (re)flag.
-- 2. "Someone else already has an active flag" was a hard error. It's now a
--    soft 200-level outcome (jsonb {warning, flagged_at}) so the API route
--    can surface the amber "someone else is planning to buy this" state
--    instead of a toast error.
-- 3. Purchased items are now distinguished from missing/inaccessible ones
--    (already_purchased vs not_found) so the API route can return the
--    correct status code and message for each.

DROP FUNCTION IF EXISTS public.gifvtme_flag_wishlist_item_intent(uuid);

CREATE FUNCTION public.gifvtme_flag_wishlist_item_intent(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_item record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT item.id, item.wishlist_id, item.status::text AS status,
         item.intent_flagged_by, item.intent_flagged_at
  INTO target_item
  FROM public.wishlist_items item
  WHERE item.id = p_item_id;

  IF NOT FOUND OR NOT public.gifvtme_can_read_wishlist_by_id(target_item.wishlist_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF target_item.status = 'purchased' THEN
    RAISE EXCEPTION 'already_purchased';
  END IF;

  IF target_item.status <> 'available' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  IF target_item.intent_flagged_by IS NOT NULL
     AND target_item.intent_flagged_by <> auth.uid()
     AND target_item.intent_flagged_at IS NOT NULL
     AND target_item.intent_flagged_at >= now() - interval '24 hours' THEN
    RETURN jsonb_build_object(
      'warning', 'already_flagged',
      'flagged_at', target_item.intent_flagged_at
    );
  END IF;

  UPDATE public.wishlist_items
  SET
    intent_flagged_by = auth.uid(),
    intent_flagged_at = now()
  WHERE id = p_item_id
    AND status::text = 'available';

  RETURN jsonb_build_object('flagged', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gifvtme_flag_wishlist_item_intent(uuid)
  TO authenticated;
