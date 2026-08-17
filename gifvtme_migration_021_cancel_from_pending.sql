-- Migration 021: allow cancelling from pending_payment/payment_failed
-- (16-ORDER-TRACKING.md)
--
-- Migration 019's validate_order_status_transition() shipped with a
-- documented, deliberate contradiction against its own spec: Functional
-- Requirement #3's prose says cancellation is allowed "from any
-- non-terminal status," but the literal transition map only allowed
-- `cancelled` from confirmed/under_review/forwarded/shipped — not from
-- pending_payment/payment_failed. That was implemented verbatim rather than
-- guessed at, pending an explicit business decision (see ROADMAP.md,
-- memory.md). Resolved 2026-08-12 in favor of the broader FR3 rule: an
-- order that never completed payment can now be explicitly cancelled
-- instead of being stuck in pending_payment/payment_failed indefinitely.
--
-- Whether migration 019 itself has been applied to the live Supabase
-- project was never confirmed from this environment (same "flag it, don't
-- assume" situation as every other migration here). CREATE OR REPLACE
-- makes this migration safe to run either way — after 019, or standing in
-- for 019's function definition if 019 hasn't been applied yet.

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending_payment": ["confirmed", "payment_failed", "cancelled"],
    "payment_failed": ["pending_payment", "cancelled"],
    "confirmed": ["under_review", "cancelled"],
    "under_review": ["forwarded", "cancelled"],
    "forwarded": ["shipped", "cancelled"],
    "shipped": ["delivered", "cancelled"],
    "delivered": ["refunded"],
    "cancelled": [],
    "refunded": []
  }';
BEGIN
  IF NOT (valid_transitions->OLD.status @> to_jsonb(NEW.status)) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
