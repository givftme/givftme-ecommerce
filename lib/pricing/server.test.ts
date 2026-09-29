import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
import { publishRate } from "./server";
import { digest, issueRatePreview } from "./preview";
import type { RateProposal } from "./validation";

const admin = "11111111-1111-4111-8111-111111111111";
const proposal: RateProposal = { policy_key: "linked", rate_bps: 1000, expected_revision: 0, reason: "Test",
  sample_amount_ngn: "100.50", sample_delivery_ngn: null };
function database(prior: unknown = null) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: prior, error: null }) };
  const rpc = vi.fn().mockResolvedValue({ data: { version: { id: "version-1" }, revision: 1 }, error: null });
  return { db: { from: vi.fn().mockReturnValue(query), rpc } as unknown as SupabaseClient, rpc };
}
afterEach(() => vi.unstubAllEnvs());

describe("publication retries", () => {
  it("resolves a completed identical request before checking expired previews or rotated secrets", async () => {
    const result = { revision: 1, version: { id: "version-1" } };
    const token = "expired-token";
    const { db, rpc } = database({ request_hash: digest({ proposal, preview_token: token }), details: { result } });
    vi.stubEnv("PRICING_PREVIEW_SECRET", "");
    expect(await publishRate(admin, "request-1", proposal, token, db)).toEqual(result);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuses reuse with changed content before mutation", async () => {
    const { db, rpc } = database({ request_hash: "different", details: {} });
    await expect(publishRate(admin, "request-1", proposal, "token", db)).rejects.toThrow("idempotency_conflict");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("passes the reviewed revision, nonce and expiry into one atomic database mutation", async () => {
    vi.stubEnv("PRICING_PREVIEW_SECRET", "test-secret-with-at-least-32-bytes-long");
    const preview = issueRatePreview(admin, proposal);
    const { db, rpc } = database();
    await publishRate(admin, "request-1", proposal, preview.preview_token, db);
    expect(rpc).toHaveBeenCalledWith("publish_gift_pricing_rate", expect.objectContaining({
      p_rate_bps: 1000, p_expected_revision: 0, p_actor_id: admin, p_request_key: "request-1",
      p_preview_nonce: expect.any(String), p_preview_expires_at: preview.expires_at,
    }));
    rpc.mockResolvedValueOnce({ data: null, error: { message: "pricing_revision_conflict" } });
    await expect(publishRate(admin, "request-2", proposal, preview.preview_token, db)).rejects.toMatchObject({ status: 409 });
  });
});
