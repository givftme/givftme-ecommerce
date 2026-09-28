import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/admin/auth", () => ({ getAdminApiUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
import { getAdminApiUser } from "@/lib/admin/auth";
import { authorizePricingAdmin } from "./http";

function request(headers: Record<string,string> = {}) {
  return new Request("https://gifts.example/api/admin/pricing/preview", { method: "POST", headers: {
    Origin: "https://gifts.example", "Content-Type": "application/json", "Idempotency-Key": "request-123",
    ...headers,
  }, body: "{}" });
}
beforeEach(() => {
  vi.stubEnv("NEXT_APP_URL", "https://gifts.example");
  vi.mocked(getAdminApiUser).mockResolvedValue({ id: "admin" } as Awaited<ReturnType<typeof getAdminApiUser>>);
});
afterEach(() => vi.unstubAllEnvs());

describe("pricing admin request boundary", () => {
  it("requires current server admin authorization even with valid request headers", async () => {
    vi.mocked(getAdminApiUser).mockResolvedValue(null);
    await expect(authorizePricingAdmin(request())).rejects.toMatchObject({ code: "admin_access_required", status: 403 });
  });
  it("rejects cross origin, missing origin, non JSON and missing operation key requests", async () => {
    const blockedHeaders: Array<Record<string, string>> = [{ Origin: "https://evil.example" }, { Origin: "" }, { "Sec-Fetch-Site": "cross-site" }];
    for (const headers of blockedHeaders) {
      await expect(authorizePricingAdmin(request(headers))).rejects.toMatchObject({ code: "same_origin_required" });
    }
    await expect(authorizePricingAdmin(request({ "Content-Type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    await expect(authorizePricingAdmin(request({ "Idempotency-Key": "" }))).rejects.toMatchObject({ code: "idempotency_key_required" });
  });
  it("permits an authenticated admin with same origin JSON and a bounded key", async () => {
    await expect(authorizePricingAdmin(request())).resolves.toMatchObject({ id: "admin" });
  });
});
