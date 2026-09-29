import { afterEach, describe, expect, it, vi } from "vitest";
import { digest, issueRatePreview, verifyRatePreview } from "./preview";
import { proposalSchema, type RateProposal } from "./validation";

const admin = "11111111-1111-4111-8111-111111111111";
const proposal: RateProposal = { policy_key: "linked", rate_bps: 1000, expected_revision: 0,
  reason: "Test rate publication", sample_amount_ngn: "100.50", sample_delivery_ngn: null };
afterEach(() => vi.unstubAllEnvs());

describe("reviewed publication", () => {
  it("requires a configured signing secret", () => {
    vi.stubEnv("PRICING_PREVIEW_SECRET", "");
    expect(() => issueRatePreview(admin, proposal)).toThrow("pricing_preview_unconfigured");
  });
  it("binds the entire proposal, calculated amounts, admin and ten minute lifetime", () => {
    vi.stubEnv("PRICING_PREVIEW_SECRET", "test-secret-with-at-least-32-bytes-long");
    const issued = issueRatePreview(admin, proposal, 1000);
    expect(issued.calculation).toMatchObject({ gift_price_ngn: "111", total_ngn: null });
    expect(verifyRatePreview(issued.preview_token, admin, proposal, 2000).purpose).toBe("rate_publish");
    expect(() => verifyRatePreview(issued.preview_token, admin, proposal, 601000)).toThrow("preview_expired");
    expect(() => verifyRatePreview(issued.preview_token, "22222222-2222-4222-8222-222222222222", proposal, 2000)).toThrow("preview_invalid");
    for (const changed of [
      { ...proposal, rate_bps: 0 }, { ...proposal, reason: "Changed" },
      { ...proposal, expected_revision: 1 }, { ...proposal, sample_amount_ngn: "101" },
      { ...proposal, sample_delivery_ngn: "0" }, { ...proposal, policy_key: "manual_sourced" as const },
    ]) expect(() => verifyRatePreview(issued.preview_token, admin, changed, 2000)).toThrow("preview_changed");
    expect(() => verifyRatePreview("x" + issued.preview_token, admin, proposal, 2000)).toThrow("preview_invalid");
  });
  it("uses deterministic digests and fresh nonces", () => {
    vi.stubEnv("PRICING_PREVIEW_SECRET", "test-secret-with-at-least-32-bytes-long");
    expect(digest({ a: 1, b: 2 })).toBe(digest({ b: 2, a: 1 }));
    expect(issueRatePreview(admin, proposal).preview_token).not.toBe(issueRatePreview(admin, proposal).preview_token);
  });
  it("accepts explicit zero but rejects missing rates and forged extra terms", () => {
    expect(proposalSchema.safeParse({ ...proposal, rate_bps: 0 }).success).toBe(true);
    expect(proposalSchema.safeParse({ ...proposal, rate_bps: undefined }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...proposal, final_total: "1" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...proposal, policy_key: "manual_cash", sample_amount_ngn: "100.50" }).success).toBe(false);
  });
});
