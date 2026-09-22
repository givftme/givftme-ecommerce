import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const exchangeCodeForSession = vi.fn();

describe("auth callback return destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
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

  it("rejects an external return destination", async () => {
    const response = await GET(new NextRequest("https://givftme.test/callback?code=example&redirect=https%3A%2F%2Fevil.test"));
    expect(response.headers.get("location")).toBe("https://givftme.test/wishlists");
  });
});
