import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { calculatePhysical } from "./calculate";
import type { GiftEstimate } from "./types";

export interface CandidatePriceSource {
  source_price: string | number | null;
  source_currency: string;
  converted_price_ngn: string | number | null;
  fx_rate: number | null;
  fx_rate_source: string | null;
  fx_as_of: string | null;
}

export function candidateSourceAmount(candidate: CandidatePriceSource): string | null {
  if (candidate.source_currency.trim().toUpperCase() === "NGN") return candidate.source_price === null ? null : String(candidate.source_price);
  if (candidate.converted_price_ngn === null || !candidate.fx_rate || !Number.isFinite(candidate.fx_rate) || candidate.fx_rate <= 0 || !candidate.fx_rate_source || !candidate.fx_as_of) return null;
  return String(candidate.converted_price_ngn);
}

export function unavailableEstimate(revision = 0): GiftEstimate {
  return { state: "pricing_unavailable", currency: "NGN", quote_id: null, quote_state_revision: null,
    item_pricing_revision: revision, selected_variant_label: null, quantity: 1, expires_at: null,
    gift_price_ngn: null, delivery_ngn: null, total_ngn: null, payment_availability: "unavailable" };
}

export function estimateCandidate(candidate: CandidatePriceSource, rateBps: number | null, revision = 0): GiftEstimate {
  const unavailable = unavailableEstimate(revision);
  const amount = candidateSourceAmount(candidate);
  if (rateBps === null || amount === null) return unavailable;
  try { return { ...unavailable, state: "estimate", gift_price_ngn: calculatePhysical(amount, rateBps, null).gift_price_ngn }; }
  catch { return unavailable; }
}

// Call only after wishlist access and prices_visible have been checked. This is
// an indicative linked estimate, never a PricingSubject or checkout permission.
export async function getLinkedGiftEstimate(itemId: string, db?: SupabaseClient): Promise<GiftEstimate> {
  try {
    const client = db ?? createServiceClient();
    const { data: item, error: itemError } = await client.from("wishlist_items")
      .select("origin,product_url,pricing_revision,active_price_quote_id").eq("id", itemId).maybeSingle();
    if (itemError || !item || item.origin !== "external" || !item.product_url) return unavailableEstimate();
    // Later quote reads must follow the explicit pointer. Never substitute an
    // estimate for a commitment created by a future quote integration.
    if (item.active_price_quote_id) return unavailableEstimate(item.pricing_revision);
    const { data: links, error: linkError } = await client.from("gift_museum_candidate_wishlist_items")
      .select("candidate_id").eq("wishlist_item_id", itemId).limit(2);
    if (linkError || links?.length !== 1) return unavailableEstimate(item.pricing_revision);
    const [{ data: candidate, error: candidateError }, { data: policy, error: policyError }] = await Promise.all([
      client.from("gift_museum_candidates").select("source_price,source_currency,converted_price_ngn,fx_rate,fx_rate_source,fx_as_of").eq("id", links[0].candidate_id).maybeSingle(),
      client.from("gift_pricing_policies").select("active_version_id").eq("key", "linked").single(),
    ]);
    if (candidateError || policyError || !candidate || !policy?.active_version_id) {
      console.info("pricing.estimate_unavailable", { item_id: itemId, reason: policyError || candidateError ? "storage_unavailable" : !candidate ? "source_unavailable" : "policy_unconfigured" });
      return unavailableEstimate(item.pricing_revision);
    }
    const { data: rate, error: rateError } = await client.from("gift_pricing_rate_versions").select("rate_bps")
      .eq("id", policy.active_version_id).eq("policy_key", "linked").single();
    return rateError ? unavailableEstimate(item.pricing_revision) : estimateCandidate(candidate as CandidatePriceSource, rate.rate_bps, item.pricing_revision);
  } catch {
    console.warn("pricing.estimate_unavailable");
    return unavailableEstimate();
  }
}
