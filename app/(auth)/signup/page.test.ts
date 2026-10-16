import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import SignupPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/components/auth/AuthForm", () => ({ AuthForm: () => null }));

function render(searchParams: Record<string, string>) {
  return SignupPage({ searchParams: Promise.resolve(searchParams) });
}

describe("signup account type guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends visitors without a type to /get-started", async () => {
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/get-started");
  });

  it("sends any other type to /get-started", async () => {
    await expect(render({ type: "business" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/get-started");
  });

  it("keeps the return path through the detour", async () => {
    await expect(render({ redirect: "/w/abc" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/get-started?redirect=${encodeURIComponent("/w/abc")}`);
  });

  it("renders the form for individuals", async () => {
    const page = await render({ type: "individual", redirect: "/w/abc" });
    expect(redirect).not.toHaveBeenCalled();
    expect(page.props).toMatchObject({ mode: "signup", redirectTo: "/w/abc" });
  });
});
