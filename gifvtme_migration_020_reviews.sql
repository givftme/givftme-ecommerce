-- Migration 020: Reviews (17-REVIEWS.md)
--
-- Genuinely new table — unlike orders/order_status_history/important_dates/
-- thank_you_messages, `reviews` never existed live before this migration
-- (see ROADMAP.md "Not started" and DATABASE_SCHEMA.md's own "to be added"
-- note). Still written defensively (IF NOT EXISTS / DROP-then-CREATE)
-- throughout, same as every other migration in this repo, since this file
-- itself has already been applied once and needs to be safely re-runnable
-- as its own RLS policies are revised in place.

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  catalog_product_id TEXT NOT NULL, -- Sanity document _id
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_review_per_user_per_product UNIQUE (user_id, catalog_product_id)
);

CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(catalog_product_id);
CREATE INDEX IF NOT EXISTS reviews_user_idx ON reviews(user_id);

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

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS (spec's Permissions and Authorization section). The route handler's
-- isVerifiedPurchaser check remains the primary gate (it's what produces a
-- friendly 403 message) — this predicate is defense-in-depth so business
-- rule #13 is also enforced at the DB level against a client that writes
-- directly through PostgREST with a valid session, bypassing /api/reviews
-- entirely. Mirrors the EXISTS-join pattern migration 019 already uses for
-- order_status_history's RLS.
-- ---------------------------------------------------------------------
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create their own reviews" ON reviews;
CREATE POLICY "Users can create their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      JOIN order_items ON order_items.order_id = orders.id
      WHERE orders.buyer_id = auth.uid()
        AND orders.status = 'delivered'
        AND order_items.catalog_product_id = reviews.catalog_product_id
    )
  );

DROP POLICY IF EXISTS "Authors can update their own reviews" ON reviews;
CREATE POLICY "Authors can update their own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      JOIN order_items ON order_items.order_id = orders.id
      WHERE orders.buyer_id = auth.uid()
        AND orders.status = 'delivered'
        AND order_items.catalog_product_id = reviews.catalog_product_id
    )
  );

DROP POLICY IF EXISTS "Authors can delete their own reviews" ON reviews;
CREATE POLICY "Authors can delete their own reviews"
  ON reviews FOR DELETE
  USING (user_id = auth.uid());
