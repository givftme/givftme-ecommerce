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
