import { beforeEach, describe, expect, it, vi } from "vitest";

const recordEvent = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/events/server", () => ({ recordEvent: (...args: unknown[]) => recordEvent(...args) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { POST } = await import("@/app/api/events/route");

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

describe("POST /api/events", () => {
  beforeEach(() => {
    recordEvent.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("records an allowed event with the session user and visitor ids", async () => {
    const response = await post(
      { event: "wishlist_shared", props: { wishlist_id: "w1", destination: "copy" } },
      { cookie: "gv_anon=anon-1; gv_sid=sess-1", "x-vercel-ip-country": "GB" },
    );
    expect(response.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: "wishlist_shared",
      userId: "user-1",
      anonId: "anon-1",
      sessionId: "sess-1",
      props: { wishlist_id: "w1", destination: "copy" },
      context: expect.objectContaining({ country: "GB" }),
    }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("issues visitor cookies on first contact", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await post({ event: "wishlist_shared", props: {} });
    expect(response.headers.get("set-cookie")).toContain("gv_anon=");
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it.each([
    ["server-only events", { event: "order_placed", props: { value: 1_000_000 } }],
    ["unknown events", { event: "nope" }],
    ["malformed JSON", "{"],
    ["oversized props", { event: "wishlist_shared", props: { blob: "x".repeat(5000) } }],
  ])("ignores %s but still answers 200", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("answers 200 even when recording throws", async () => {
    recordEvent.mockRejectedValue(new Error("db down"));
    const response = await post({ event: "wishlist_shared", props: {} });
    expect(response.status).toBe(200);
  });
});
