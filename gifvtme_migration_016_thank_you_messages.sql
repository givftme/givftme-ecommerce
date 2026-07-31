-- Migration 016: Thank-you messages — formal schema + catalog-flow trigger.
--
-- `thank_you_messages` and the external-flow `on_purchase_created` trigger
-- already exist live in Supabase with no migration file backing them (every
-- migration from 003 onward has assumed they exist). This migration finally
-- gives the table a SQL source of truth, using the same defensive
-- CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS pattern migration 015
-- used for `important_dates`.
--
-- Deliberately does NOT touch `on_purchase_created` — that trigger is already
-- running in production for the affiliate flow, and its exact definition is
-- unverifiable from this repo (no DB access from this environment). Recreating
-- it from a guess risks silently replacing working production behavior with
-- something subtly wrong. Only the genuinely new `on_order_confirmed_thank_you`
-- trigger (catalog-flow auto thank-you, which does not exist anywhere today,
-- live or in code) is added here.

CREATE TABLE IF NOT EXISTS public.thank_you_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  permanently_failed boolean NOT NULL DEFAULT false,
  -- Lets the cron atomically claim a row before sending, same pattern as
  -- `reminders.claimed_at` (migration 015) — guards against two overlapping
  -- cron invocations both sending the same auto thank-you.
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Defensive column patch in case the live table (created outside this repo's
-- migration history) is missing any of these.
ALTER TABLE public.thank_you_messages
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receiver_id uuid,
  ADD COLUMN IF NOT EXISTS buyer_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanently_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.thank_you_messages
  DROP CONSTRAINT IF EXISTS thank_you_messages_type_check;

ALTER TABLE public.thank_you_messages
  ADD CONSTRAINT thank_you_messages_type_check
  CHECK (type IN ('auto', 'personal'))
  NOT VALID;

ALTER TABLE public.thank_you_messages
  DROP CONSTRAINT IF EXISTS purchase_or_order_required;

ALTER TABLE public.thank_you_messages
  ADD CONSTRAINT purchase_or_order_required
  CHECK (
    (purchase_id IS NOT NULL AND order_id IS NULL) OR
    (order_id IS NOT NULL AND purchase_id IS NULL)
  )
  NOT VALID;

CREATE INDEX IF NOT EXISTS thank_you_messages_pending_auto_idx
  ON public.thank_you_messages (created_at)
  WHERE type = 'auto' AND sent = false AND permanently_failed = false;

CREATE INDEX IF NOT EXISTS thank_you_messages_purchase_id_idx
  ON public.thank_you_messages (purchase_id);

CREATE INDEX IF NOT EXISTS thank_you_messages_order_id_idx
  ON public.thank_you_messages (order_id);

ALTER TABLE public.thank_you_messages ENABLE ROW LEVEL SECURITY;

-- No DELETE grant — thank-you records are never removed by users, only by
-- the ON DELETE CASCADE from their parent purchase/order.
GRANT SELECT, INSERT ON public.thank_you_messages TO authenticated;

DROP POLICY IF EXISTS "gifvtme_thank_you_messages_participant_select" ON public.thank_you_messages;
DROP POLICY IF EXISTS "gifvtme_thank_you_messages_receiver_insert" ON public.thank_you_messages;

-- Both the receiver (who sent or will send the thank-you) and the buyer (who
-- receives it) can read a row referencing them — neither can read the
-- other's unrelated thank-you records.
CREATE POLICY "gifvtme_thank_you_messages_participant_select"
ON public.thank_you_messages
FOR SELECT
TO authenticated
USING (auth.uid() = receiver_id OR auth.uid() = buyer_id);

-- App-level ownership checks (verifying the receiver actually owns the
-- referenced purchase/order) happen in the route handler before this insert
-- is attempted, same as `/api/important-dates`'s pattern — this policy is
-- defense-in-depth requiring the caller to at least be the receiver they
-- claim to be, not the sole enforcement.
CREATE POLICY "gifvtme_thank_you_messages_receiver_insert"
ON public.thank_you_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = receiver_id AND type = 'personal');

-- Genuinely new: nothing today creates a thank-you record for a confirmed
-- catalog order. Only fires for orders that originated from a wishlist item
-- (business rule: no receiver to thank on a direct shop purchase). Guarded
-- against firing twice for the same order (defensive — normal status flow
-- never re-enters 'confirmed', but this makes the trigger idempotent anyway).
CREATE OR REPLACE FUNCTION public.handle_order_confirmed_thank_you()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.thank_you_messages (
      order_id, wishlist_item_id, receiver_id, buyer_id, type, message, sent
    )
    SELECT
      NEW.id,
      NEW.wishlist_item_id,
      wl.user_id,
      NEW.buyer_id,
      'auto',
      COALESCE(u.default_thank_you_msg, 'Thank you so much for the gift, I really appreciate you!'),
      false
    FROM public.wishlist_items wi
    JOIN public.wishlists wl ON wl.id = wi.wishlist_id
    JOIN public.users u ON u.id = wl.user_id
    WHERE wi.id = NEW.wishlist_item_id
      AND NEW.wishlist_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.thank_you_messages existing WHERE existing.order_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_order_confirmed_thank_you ON public.orders;

CREATE TRIGGER on_order_confirmed_thank_you
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_confirmed_thank_you();
