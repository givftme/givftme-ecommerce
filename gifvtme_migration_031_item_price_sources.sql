-- Preserve source evidence per wishlist item instead of reading the mutable,
-- URL-deduplicated Museum candidate as that item's pricing authority.
BEGIN;

ALTER TABLE public.gift_museum_candidate_wishlist_items
  ADD COLUMN source_price numeric CHECK (
    source_price >= 0 AND source_price < 1000000000000 AND scale(source_price) <= 2
  ),
  ADD COLUMN source_currency text CHECK (source_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN converted_price_ngn numeric CHECK (
    converted_price_ngn >= 0 AND converted_price_ngn < 100000000000000 AND scale(converted_price_ngn) = 0
  ),
  ADD COLUMN fx_rate numeric CHECK (fx_rate > 0 AND fx_rate < 10000000000),
  ADD COLUMN fx_rate_source text,
  ADD COLUMN fx_as_of date;

-- Intentionally do not backfill from the shared candidate: the original
-- currency and conversion cannot be attributed to a particular item anymore.
-- Legacy links remain unpriced until their own source evidence is recaptured.
-- Existing RLS and privileges on this private association remain unchanged.
COMMIT;
