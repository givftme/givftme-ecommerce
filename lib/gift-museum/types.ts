export type CandidateStatus =
  | "pending"
  | "approved"
  | "published"
  | "rejected"
  | "needs_edit";

export type PublishMode = "external_redirect" | "catalog_checkout";

export type ScrapeStatus = "fetched" | "partial" | "manual" | "failed";

export type ScrapeConfidence = "high" | "medium" | "low";

export interface GiftMuseumCandidate {
  id: string;
  original_url: string;
  canonical_url: string;
  canonical_url_hash: string;
  public_slug: string;
  merchant: string;
  merchant_label: string | null;
  title: string;
  image_url: string | null;
  description: string | null;
  source_price: number | null;
  source_currency: string;
  converted_price_ngn: number | null;
  fx_rate: number | null;
  fx_rate_source: string | null;
  fx_as_of: string | null;
  markup_percent: number;
  delivery_buffer_ngn: number;
  rounding_ngn: number;
  recommended_price_ngn: number | null;
  admin_price_ngn: number | null;
  demand_count: number;
  status: CandidateStatus;
  publish_mode: PublishMode;
  scrape_status: ScrapeStatus;
  scrape_confidence: ScrapeConfidence;
  linked_sanity_product_id: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
