export const POLICY_KEYS = ["linked", "manual_sourced", "manual_cash", "partial_cash_payout"] as const;
export type PricingPolicyKey = (typeof POLICY_KEYS)[number];
export const CALCULATION_VERSION = "gift-pricing-v1" as const;

export const POLICY_LABELS: Record<PricingPolicyKey, string> = {
  linked: "Linked gifts",
  manual_sourced: "Manually sourced gifts",
  manual_cash: "Cash gifts",
  partial_cash_payout: "Partial cash payouts",
};

export interface RateVersion {
  id: string;
  policy_key: PricingPolicyKey;
  version: number;
  rate_bps: number;
  published_at: string;
  publisher_audit_id: string;
  reason: string;
}

export interface PricingPolicy {
  key: PricingPolicyKey;
  active_version_id: string | null;
  revision: number;
  active_version: RateVersion | null;
}

export interface PolicyPage {
  policies: PricingPolicy[];
  history: RateVersion[];
  next_cursor: number | null;
}

export interface GiftEstimate {
  state: "estimate" | "pricing_unavailable";
  currency: "NGN";
  quote_id: null;
  quote_state_revision: null;
  item_pricing_revision: number;
  selected_variant_label: null;
  quantity: 1;
  expires_at: null;
  gift_price_ngn: string | null;
  delivery_ngn: null;
  total_ngn: null;
  payment_availability: "unavailable";
}
