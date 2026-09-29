import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { digest, issueRatePreview, PricingError, sampleCalculation, verifyRatePreview } from "./preview";
import type { PolicyPage, PricingPolicy, RateVersion } from "./types";
import type { RateProposal } from "./validation";

const VERSION_FIELDS = "id,policy_key,version,rate_bps,published_at,publisher_audit_id,reason";

export function pricingEnabled() { return process.env.GIFT_PRICING_V1_ENABLED === "true"; }

export async function getPolicies(cursor = 0, db = createServiceClient()): Promise<PolicyPage> {
  const [{ data: policies, error }, { data: history, error: historyError }] = await Promise.all([
    db.from("gift_pricing_policies").select("key,active_version_id,revision").order("key"),
    db.from("gift_pricing_rate_versions").select(VERSION_FIELDS).order("published_at", { ascending: false }).order("id", { ascending: false }).range(cursor, cursor + 50),
  ]);
  if (error || historyError) throw new PricingError("pricing_storage_unavailable", 503);
  const ids = (policies || []).flatMap((policy) => policy.active_version_id ? [policy.active_version_id as string] : []);
  const { data: active, error: activeError } = ids.length
    ? await db.from("gift_pricing_rate_versions").select(VERSION_FIELDS).in("id", ids)
    : { data: [], error: null };
  if (activeError) throw new PricingError("pricing_storage_unavailable", 503);
  return {
    policies: (policies || []).map((policy) => ({ ...policy,
      active_version: active?.find((version) => version.id === policy.active_version_id && version.policy_key === policy.key) ?? null,
    })) as PricingPolicy[],
    history: (history || []).slice(0, 50) as RateVersion[],
    next_cursor: history && history.length > 50 ? cursor + 50 : null,
  };
}

export async function previewRate(adminId: string, proposal: RateProposal, purpose: "sample" | "rate_publish", db = createServiceClient()) {
  const { data, error } = await db.from("gift_pricing_policies").select("revision").eq("key", proposal.policy_key).single();
  if (error) throw new PricingError("pricing_storage_unavailable", 503);
  if (data.revision !== proposal.expected_revision) throw new PricingError("pricing_revision_conflict", 409);
  try {
    return purpose === "sample" ? { calculation: sampleCalculation(proposal), preview_token: null, expires_at: null }
      : issueRatePreview(adminId, proposal);
  } catch (error) {
    if (error instanceof PricingError) throw error;
    throw new PricingError("invalid_calculation", 422);
  }
}

export async function publishRate(adminId: string, requestKey: string, proposal: RateProposal, token: string, db: SupabaseClient = createServiceClient()) {
  const requestHash = digest({ proposal, preview_token: token });
  // Authenticate in the handler first. Completed retries survive token expiry and rotation.
  const { data: prior, error: priorError } = await db.from("gift_pricing_events").select("request_hash,details")
    .eq("actor_audit_id", adminId).eq("event_type", "rate_publish").eq("request_key", requestKey).maybeSingle();
  if (priorError) throw new PricingError("pricing_storage_unavailable", 503);
  if (prior) {
    if (prior.request_hash !== requestHash) throw new PricingError("idempotency_conflict", 409);
    return prior.details.result as { version: RateVersion; revision: number };
  }
  const preview = verifyRatePreview(token, adminId, proposal);
  const { data, error } = await db.rpc("publish_gift_pricing_rate", {
    p_policy_key: proposal.policy_key, p_rate_bps: proposal.rate_bps, p_expected_revision: proposal.expected_revision,
    p_actor_id: adminId, p_reason: proposal.reason, p_request_key: requestKey, p_request_hash: requestHash,
    p_preview_nonce: preview.nonce, p_preview_expires_at: new Date(preview.expires_at).toISOString(),
  });
  if (error) {
    const conflict = ["idempotency_conflict", "pricing_revision_conflict", "preview_expired", "preview_consumed"].find((code) => error.message.includes(code));
    if (conflict) throw new PricingError(conflict, 409);
    if (error.code === "23505") throw new PricingError("preview_consumed", 409);
    throw new PricingError("pricing_publication_failed", 503);
  }
  const result = data as { version: RateVersion; revision: number };
  console.info("pricing.rate_published", { rate_version_id: result.version.id, policy: proposal.policy_key, revision: result.revision });
  return result;
}
