import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "./proxy";

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn() }));

describe("authentication return destinations", () => {
  beforeEach(() => vi.clearAllMocks());

  function session(signedIn: boolean) {
    const response = NextResponse.next();
    response.cookies.set("session-refresh", "updated", { httpOnly: true });
    vi.mocked(updateSession).mockResolvedValue({
      response,
      user: signedIn ? { id: "user-1" } : null,
    } as Awaited<ReturnType<typeof updateSession>>);
  }

  it.each(["/", "/shop?sort=price&category=gifts", "/gift/resume?token=example"])(
    "honors %s when an authenticated user reaches login or signup",
    async (destination) => {
      session(true);
      for (const route of ["/login", "/signup"]) {
        const response = await proxy(new NextRequest(`https://givftme.test${route}?redirect=${encodeURIComponent(destination)}`));
        expect(response.headers.get("location")).toBe(`https://givftme.test${destination}`);
        expect(response.cookies.get("session-refresh")?.value).toBe("updated");
      }
    },
  );

  it.each(["https://evil.test", "//evil.test", "/%2f/evil.test", "/login", "/signup?redirect=%2F", "/shop/../login", "/%6cogin"])(
    "does not follow unsafe or looping destination %s",
    async (destination) => {
      session(true);
      const response = await proxy(new NextRequest(`https://givftme.test/login?redirect=${encodeURIComponent(destination)}`));
      expect(response.headers.get("location")).toBe("https://givftme.test/wishlists");
    },
  );

  it("keeps the protected destination and its query for signed out users", async () => {
    session(false);
    const response = await proxy(new NextRequest("https://givftme.test/account/orders?status=paid"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/account/orders?status=paid");
  });
});

describe("admin route gate", () => {
  beforeEach(() => vi.clearAllMocks());

  function session(user: { id: string } | null, role: string | null, error: unknown = null) {
    const rpc = vi.fn().mockResolvedValue({ data: role, error });
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      supabase: { rpc },
      user,
    } as unknown as Awaited<ReturnType<typeof updateSession>>);
    return rpc;
  }

  it("sends signed out visitors to login with their destination", async () => {
    session(null, null);
    const response = await proxy(new NextRequest("https://givftme.test/admin/orders?status=shipped"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/admin/orders?status=shipped");
  });

  it("sends customers without a role home with an error", async () => {
    const rpc = session({ id: "customer" }, null);
    const response = await proxy(new NextRequest("https://givftme.test/admin"));
    expect(rpc).toHaveBeenCalledWith("gifvtme_current_user_admin_role");
    expect(response.headers.get("location")).toBe("https://givftme.test/?error=unauthorized");
  });

  it("fails closed when the role lookup errors", async () => {
    session({ id: "someone" }, "admin", { message: "function does not exist" });
    const response = await proxy(new NextRequest("https://givftme.test/admin/pulse"));
    expect(response.headers.get("location")).toBe("https://givftme.test/?error=unauthorized");
  });

  it("lets team members through", async () => {
    session({ id: "ops" }, "operations");
    const response = await proxy(new NextRequest("https://givftme.test/admin/pulse"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not gate look-alike paths", async () => {
    const rpc = session({ id: "customer" }, null);
    await proxy(new NextRequest("https://givftme.test/administrator"));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("signed-in landing by role", () => {
  beforeEach(() => vi.clearAllMocks());

  function signedInAs(role: string | null) {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      supabase: { rpc: vi.fn().mockResolvedValue({ data: role, error: null }) },
      user: { id: "u1" },
    } as unknown as Awaited<ReturnType<typeof updateSession>>);
  }

  it.each([
    ["admin", "/admin/pulse"],
    ["support", "/admin/people"],
    ["finance", "/admin/money"],
    [null, "/wishlists"],
  ])("sends a %s to %s from the login page", async (role, destination) => {
    signedInAs(role);
    const response = await proxy(new NextRequest("https://givftme.test/login"));
    expect(response.headers.get("location")).toBe(`https://givftme.test${destination}`);
  });

  it("still honours an explicit destination for team members", async () => {
    signedInAs("growth");
    const response = await proxy(new NextRequest(`https://givftme.test/login?redirect=${encodeURIComponent("/w/abc")}`));
    expect(response.headers.get("location")).toBe("https://givftme.test/w/abc");
  });

  it("uses the role home when the requested destination would loop", async () => {
    signedInAs("growth");
    const response = await proxy(new NextRequest(`https://givftme.test/login?redirect=${encodeURIComponent("/signup")}`));
    expect(response.headers.get("location")).toBe("https://givftme.test/admin/growth");
  });
});
