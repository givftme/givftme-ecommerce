import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { calculateCashTarget, calculatePartialCashPayout, calculatePhysical } from "./calculate";
import type { RateProposal } from "./validation";

export class PricingError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

export function sampleCalculation(proposal: RateProposal) {
  const { policy_key, sample_amount_ngn: amount, rate_bps: rate } = proposal;
  if (policy_key === "manual_cash") return calculateCashTarget(amount, rate);
  if (policy_key === "partial_cash_payout") return calculatePartialCashPayout({
    verified_receipts_ngn: amount, completed_refunds_ngn: "0", reversals_ngn: "0", available_unallocated_ngn: amount,
  }, rate);
  return calculatePhysical(amount, rate, proposal.sample_delivery_ngn);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function secret(): Buffer {
  const value = process.env.PRICING_PREVIEW_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new PricingError("pricing_preview_unconfigured", 503);
  return Buffer.from(value);
}

const tokenSchema = z.object({
  version: z.literal(1), purpose: z.literal("rate_publish"), admin_id: z.string().uuid(),
  proposal_digest: z.string().regex(/^[a-f0-9]{64}$/), nonce: z.string().uuid(),
  issued_at: z.number().int(), expires_at: z.number().int(),
}).strict();

export function issueRatePreview(adminId: string, proposal: RateProposal, now = Date.now()) {
  const calculation = sampleCalculation(proposal);
  const proposalDigest = digest({ proposal, calculation });
  const payload = tokenSchema.parse({ version: 1, purpose: "rate_publish", admin_id: adminId,
    proposal_digest: proposalDigest, nonce: randomUUID(), issued_at: now, expires_at: now + 600000 });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return { calculation, proposal_digest: proposalDigest, preview_token: `${encoded}.${signature}`, expires_at: new Date(payload.expires_at).toISOString() };
}

export function verifyRatePreview(token: string, adminId: string, proposal: RateProposal, now = Date.now()) {
  const key = secret();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new PricingError("preview_invalid", 422);
  const [encoded, signature] = parts;
  const expected = createHmac("sha256", key).update(encoded).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new PricingError("preview_invalid", 422);
  let parsed: z.infer<typeof tokenSchema>;
  try { parsed = tokenSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString())); }
  catch { throw new PricingError("preview_invalid", 422); }
  if (parsed.admin_id !== adminId) throw new PricingError("preview_invalid", 403);
  if (parsed.expires_at <= now || parsed.issued_at > now || parsed.expires_at - parsed.issued_at !== 600000) throw new PricingError("preview_expired", 409);
  if (parsed.proposal_digest !== digest({ proposal, calculation: sampleCalculation(proposal) })) throw new PricingError("preview_changed", 409);
  return parsed;
}
