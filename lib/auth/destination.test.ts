import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { homePathForRole } from "@/lib/admin/roles";
import { postSignInDestination } from "@/lib/auth/destination";

function session(role: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: role, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("homePathForRole", () => {
  it("sends each role to its primary screen", () => {
    expect(homePathForRole("admin")).toBe("/admin/pulse");
    expect(homePathForRole("operations")).toBe("/admin/pulse");
    expect(homePathForRole("support")).toBe("/admin/people");
    expect(homePathForRole("growth")).toBe("/admin/growth");
    expect(homePathForRole("finance")).toBe("/admin/money");
  });
});

describe("postSignInDestination", () => {
  it("honours an explicit safe return path without looking up the role", async () => {
    const { client, rpc } = session("finance");
    expect(await postSignInDestination(client, "/w/abc?invite=1")).toBe("/w/abc?invite=1");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends team members to their role's home by default", async () => {
    expect(await postSignInDestination(session("support").client, null)).toBe("/admin/people");
    expect(await postSignInDestination(session("finance").client, "https://evil.test")).toBe("/admin/money");
  });

  it("sends customers to their wishlists", async () => {
    expect(await postSignInDestination(session(null).client, undefined)).toBe("/wishlists");
  });

  it("sends business accounts to the HR dashboard", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "gifvtme_current_user_account_type" ? "business" : null,
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient;
    expect(await postSignInDestination(client, null)).toBe("/business-dashboard");
    expect(await postSignInDestination(client, "/business-dashboard/auth")).toBe("/business-dashboard/auth");
  });

  it("falls back to wishlists when the role can't be read", async () => {
    expect(await postSignInDestination(session(null, { message: "function does not exist" }).client)).toBe("/wishlists");
    expect(await postSignInDestination(session("superuser").client)).toBe("/wishlists");
    const broken = { rpc: () => { throw new Error("offline"); } } as unknown as SupabaseClient;
    expect(await postSignInDestination(broken)).toBe("/wishlists");
  });
});
