-- Migration 020: Reviews (17-REVIEWS.md)
--
-- Genuinely new table — unlike orders/order_status_history/important_dates/
-- thank_you_messages, `reviews` never existed live before this migration
-- (see ROADMAP.md "Not started" and DATABASE_SCHEMA.md's own "to be added"
-- note), so this is a plain CREATE, not the defensive
-- CREATE-IF-NOT-EXISTS-plus-ADD-COLUMN-IF-NOT-EXISTS pattern migrations
-- 015/016/019 needed for tables that predated this repo's migration history.

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  catalog_product_id TEXT NOT NULL, -- Sanity document _id
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_review_per_user_per_product UNIQUE (user_id, catalog_product_id)
);

CREATE INDEX reviews_product_idx ON reviews(catalog_product_id);
CREATE INDEX reviews_user_idx ON reviews(user_id);

-- The spec assumes update_updated_at_column() "already exists from
-- migrations 001/002" — it doesn't. No migration file in this repo (001/002
-- included) defines it or uses an updated_at trigger anywhere; this is the
-- first table in the repo's version-controlled schema with an updated_at
-- column. Defined here via CREATE OR REPLACE rather than assumed, since a
-- missing function would fail this migration outright at apply time (unlike
-- the unverifiable-but-already-running triggers noted elsewhere in this
-- repo, guessing wrong here breaks the deploy, not just risks a behavior
-- mismatch — so it's created defensively instead of assumed).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS (spec's Permissions and Authorization section). The verified-
-- purchase gate on create is enforced in the /api/reviews route handler,
-- not here — RLS alone can't express the orders/order_items join business
-- rule #13 needs, so INSERT is only restricted to "your own row", same as
-- thank_you_messages' personal-row INSERT policy.
-- ---------------------------------------------------------------------
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authors can update their own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Authors can delete their own reviews"
  ON reviews FOR DELETE
  USING (user_id = auth.uid());
