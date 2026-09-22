-- Migration 028: Gift Museum candidate queue, scrape cache, and FX cache

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gift_museum_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url text NOT NULL,
  canonical_url text NOT NULL,
  canonical_url_hash text NOT NULL UNIQUE,
  public_slug text NOT NULL UNIQUE,
  merchant text NOT NULL DEFAULT 'generic',
  merchant_label text,
  title text NOT NULL DEFAULT 'Untitled gift',
  image_url text,
  description text,
  source_price numeric(12, 2),
  source_currency text NOT NULL DEFAULT 'NGN',
  converted_price_ngn integer,
  fx_rate numeric(18, 8),
  fx_rate_source text,
  fx_as_of date,
  markup_percent numeric(5, 2) NOT NULL DEFAULT 25,
  delivery_buffer_ngn integer NOT NULL DEFAULT 5000,
  rounding_ngn integer NOT NULL DEFAULT 500,
  recommended_price_ngn integer,
  admin_price_ngn integer,
  demand_count integer NOT NULL DEFAULT 1 CHECK (demand_count >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'published', 'rejected', 'needs_edit')
  ),
  publish_mode text NOT NULL DEFAULT 'external_redirect' CHECK (
    publish_mode IN ('external_redirect', 'catalog_checkout')
  ),
  scrape_status text NOT NULL DEFAULT 'manual' CHECK (
    scrape_status IN ('fetched', 'partial', 'manual', 'failed')
  ),
  scrape_confidence text NOT NULL DEFAULT 'low' CHECK (
    scrape_confidence IN ('high', 'medium', 'low')
  ),
  linked_sanity_product_id text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_museum_candidates_status_created_idx
  ON public.gift_museum_candidates (status, created_at DESC);

CREATE INDEX IF NOT EXISTS gift_museum_candidates_publish_mode_idx
  ON public.gift_museum_candidates (publish_mode);

CREATE INDEX IF NOT EXISTS gift_museum_candidates_merchant_idx
  ON public.gift_museum_candidates (merchant);

CREATE TABLE IF NOT EXISTS public.gift_museum_candidate_wishlist_items (
  candidate_id uuid NOT NULL REFERENCES public.gift_museum_candidates(id) ON DELETE CASCADE,
  wishlist_item_id uuid NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, wishlist_item_id)
);

CREATE INDEX IF NOT EXISTS gift_museum_candidate_wishlist_items_item_idx
  ON public.gift_museum_candidate_wishlist_items (wishlist_item_id);

CREATE TABLE IF NOT EXISTS public.gift_museum_scrape_cache (
  canonical_url_hash text PRIMARY KEY,
  canonical_url text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_museum_scrape_cache_expires_idx
  ON public.gift_museum_scrape_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL DEFAULT 'NGN',
  rate numeric(18, 8) NOT NULL,
  source text NOT NULL DEFAULT 'exchangerate-api',
  as_of date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency, as_of)
);

CREATE OR REPLACE FUNCTION public.gifvtme_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gift_museum_candidates_touch_updated_at
  ON public.gift_museum_candidates;
CREATE TRIGGER gift_museum_candidates_touch_updated_at
  BEFORE UPDATE ON public.gift_museum_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.gifvtme_touch_updated_at();

DROP TRIGGER IF EXISTS gift_museum_scrape_cache_touch_updated_at
  ON public.gift_museum_scrape_cache;
CREATE TRIGGER gift_museum_scrape_cache_touch_updated_at
  BEFORE UPDATE ON public.gift_museum_scrape_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.gifvtme_touch_updated_at();

ALTER TABLE public.gift_museum_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_museum_candidate_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_museum_scrape_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
