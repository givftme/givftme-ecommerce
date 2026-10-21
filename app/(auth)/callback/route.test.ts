import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const exchangeCodeForSession = vi.fn();
const rpc = vi.fn();

describe("auth callback return destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
      rpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it.each(["/", "/shop?category=gifts&sort=price", "/gift/resume?token=example"])(
    "returns to %s after a successful code exchange",
    async (destination) => {
      const response = await GET(new NextRequest(`https://givftme.test/callback?code=example&redirect=${encodeURIComponent(destination)}`));
      expect(exchangeCodeForSession).toHaveBeenCalledWith("example");
      expect(response.headers.get("location")).toBe(`https://givftme.test${destination}`);
    },
  );

  it("preserves the destination for retry when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired") });
    const response = await GET(new NextRequest("https://givftme.test/callback?code=expired&redirect=%2Fshop%3Fsort%3Dprice"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/shop?sort=price");
    expect(location.searchParams.get("error")).toBe("confirmation_failed");
  });

  it("returns a failed business confirmation to the business sign-in screen", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired") });
    const response = await GET(new NextRequest("https://givftme.test/callback?code=expired&redirect=%2Fbusiness-dashboard"));
    expect(response.headers.get("location")).toBe("https://givftme.test/business-dashboard/auth?error=confirmation_failed");
  });

  it("reports an expired email link (Supabase's access_denied, no code) as a dead confirmation link", async () => {
    const response = await GET(
      new NextRequest("https://givftme.test/callback?redirect=%2Fbusiness-dashboard&error=access_denied&error_code=otp_expired"),
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://givftme.test/business-dashboard/auth?error=confirmation_failed");
  });

  it("tells a cancelled Google sign-in apart from a dead confirmation link", async () => {
    const response = await GET(
      new NextRequest("https://givftme.test/callback?via=oauth&redirect=%2Fbusiness-dashboard&error=access_denied"),
    );
    expect(response.headers.get("location")).toBe("https://givftme.test/business-dashboard/auth?error=oauth_cancelled");
  });

  it("reports a failed Google code exchange as a Google failure", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad_code_verifier") });
    const response = await GET(new NextRequest("https://givftme.test/callback?via=oauth&code=example&redirect=%2Fbusiness-dashboard"));
    expect(response.headers.get("location")).toBe("https://givftme.test/business-dashboard/auth?error=oauth");
  });

  it("sends a consumer's failed Google sign-in to the login with the return path kept", async () => {
    const response = await GET(
      new NextRequest("https://givftme.test/callback?via=oauth&redirect=%2Fshop&error=server_error"),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth");
    expect(location.searchParams.get("redirect")).toBe("/shop");
  });

  it("completes a Google sign-in as before when the exchange succeeds", async () => {
    const response = await GET(new NextRequest("https://givftme.test/callback?via=oauth&code=example&redirect=%2Fshop"));
    expect(response.headers.get("location")).toBe("https://givftme.test/shop");
  });

  it("never sends a failure to an external destination", async () => {
    const response = await GET(
      new NextRequest("https://givftme.test/callback?via=oauth&redirect=https%3A%2F%2Fevil.test&error=access_denied"),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://givftme.test");
    expect(location.searchParams.get("redirect")).toBe("/wishlists");
  });

  it("rejects an external return destination", async () => {
    const response = await GET(new NextRequest("https://givftme.test/callback?code=example&redirect=https%3A%2F%2Fevil.test"));
    expect(response.headers.get("location")).toBe("https://givftme.test/wishlists");
  });

  it("lands a team member on their role's home when no destination was given", async () => {
    rpc.mockResolvedValue({ data: "finance", error: null });
    const response = await GET(new NextRequest("https://givftme.test/callback?code=example"));
    expect(rpc).toHaveBeenCalledWith("gifvtme_current_user_admin_role");
    expect(response.headers.get("location")).toBe("https://givftme.test/admin/money");
  });
});
