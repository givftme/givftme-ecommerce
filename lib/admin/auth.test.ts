import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const roleLookup = vi.fn();
const logAdminAction = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => roleLookup() }) }) }),
  }),
}));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...args: unknown[]) => logAdminAction(...args) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { requireAdminApi } = await import("@/lib/admin/auth");

function signedIn(role: string | null) {
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "u1@givftme.test" } } });
  roleLookup.mockResolvedValue({ data: { role, full_name: "Ada", email: "u1@givftme.test", avatar_url: null }, error: null });
}

describe("requireAdminApi", () => {
  beforeEach(() => {
    getUser.mockReset();
    roleLookup.mockReset();
    logAdminAction.mockReset();
  });

  it("returns 401 without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const auth = await requireAdminApi("pulse");
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.response.status).toBe(401);
  });

  it("returns 403 for customers", async () => {
    signedIn(null);
    const auth = await requireAdminApi("pulse");
    if (auth.ok) throw new Error("expected denial");
    expect(auth.response.status).toBe(403);
  });

  it("returns 403 when the role can't open the screen", async () => {
    signedIn("finance");
    const auth = await requireAdminApi("people");
    if (auth.ok) throw new Error("expected denial");
    expect(auth.response.status).toBe(403);
  });

  it("returns 403 when the screen is allowed but the action isn't", async () => {
    signedIn("finance");
    expect((await requireAdminApi("orders")).ok).toBe(true);
    const auth = await requireAdminApi("orders", { action: "updateOrderStatus" });
    if (auth.ok) throw new Error("expected denial");
    expect(auth.response.status).toBe(403);
  });

  it("authorizes and logs the read when an audit entry is given", async () => {
    signedIn("operations");
    const auth = await requireAdminApi("orders", { action: "updateOrderStatus", audit: { action: "list_orders" } });
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.member).toMatchObject({ id: "u1", role: "operations" });
    expect(logAdminAction).toHaveBeenCalledWith(expect.anything(), "u1", { action: "list_orders" });
  });

  it("fails closed with 500 when the role lookup errors", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    roleLookup.mockResolvedValue({ data: null, error: { message: "column users.role does not exist" } });
    const auth = await requireAdminApi("pulse");
    if (auth.ok) throw new Error("expected denial");
    expect(auth.response.status).toBe(500);
  });
});
