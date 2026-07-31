import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { DELETE, POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/wishlist/server", () => ({
  getAuthenticatedApiUser: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetAuthenticatedApiUser = vi.mocked(getAuthenticatedApiUser);

function context(itemId = "item-1") {
  return { params: Promise.resolve({ itemId }) };
}

function mockRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  // @ts-expect-error only .rpc is read by these routes
  mockedCreateClient.mockResolvedValue({ rpc });
  return rpc;
}

describe("POST /api/wishlists/items/[itemId]/flag-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue(null);
    const rpc = mockRpc({ data: null, error: null });

    const response = await POST(new Request("http://localhost"), context());

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns { flagged: true } when the RPC succeeds", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockRpc({ data: { flagged: true }, error: null });

    const response = await POST(new Request("http://localhost"), context());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ flagged: true });
  });

  it("returns 200 with an already_flagged warning instead of overwriting", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockRpc({
      data: { warning: "already_flagged", flagged_at: "2026-07-30T00:00:00Z" },
      error: null,
    });

    const response = await POST(new Request("http://localhost"), context());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      warning: "already_flagged",
      flagged_at: "2026-07-30T00:00:00Z",
    });
  });

  it("returns 409 with the purchased message when the item is already purchased", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockRpc({ data: null, error: { message: "already_purchased" } });

    const response = await POST(new Request("http://localhost"), context());
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("This item has already been purchased.");
  });

  it("returns 404 when the item doesn't exist or isn't accessible", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockRpc({ data: null, error: { message: "not_found" } });

    const response = await POST(new Request("http://localhost"), context());

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/wishlists/items/[itemId]/flag-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue(null);
    const rpc = mockRpc({ data: null, error: null });

    const response = await DELETE(new Request("http://localhost"), context());

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns { cleared: true } on success, including a no-op clear of someone else's flag", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockRpc({ data: null, error: null });

    const response = await DELETE(new Request("http://localhost"), context());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ cleared: true });
  });
});
