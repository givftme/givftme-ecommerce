import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { getBusinessSession, type BusinessSession } from "@/lib/business-dashboard/queries";
import BusinessAuthPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/business-dashboard/queries", () => ({ getBusinessSession: vi.fn() }));
vi.mock("@/components/business-dashboard/BizAuthScreen", () => ({ BizAuthScreen: () => null }));

const user = { id: "user-1", email: "ada@acme.test" } as NonNullable<BusinessSession["user"]>;
const member = { id: "m-1" } as NonNullable<BusinessSession["member"]>;

function session(value: BusinessSession) {
  vi.mocked(getBusinessSession).mockResolvedValue(value);
}

async function render(params: Record<string, string> = {}) {
  const element = (await BusinessAuthPage({ searchParams: Promise.resolve(params) })) as ReactElement<{
    initialTab: string;
    initialError: string | null;
    offerResend: boolean;
    signedIn: { email: string; state: string } | null;
  }>;
  return element.props;
}

describe("business auth page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a business member with the business account type to the dashboard", async () => {
    session({ user, member, accountType: "business" });
    await expect(render()).rejects.toThrow("redirect:/business-dashboard");
  });

  it("doesn't loop a member the proxy would turn away back to the dashboard", async () => {
    session({ user, member, accountType: "consumer" });
    const props = await render({ error: "not_business" });
    expect(redirect).not.toHaveBeenCalled();
    expect(props.signedIn).toEqual({ email: "ada@acme.test", state: "incomplete" });
    // The notice explains it, so the generic not_business message isn't repeated.
    expect(props.initialError).toBeNull();
  });

  it("calls a business-type login without a membership incomplete, not personal", async () => {
    session({ user, member: null, accountType: "business" });
    expect((await render()).signedIn).toEqual({ email: "ada@acme.test", state: "incomplete" });
  });

  it("shows a signed-in personal account its notice", async () => {
    session({ user, member: null, accountType: "consumer" });
    const props = await render({ type: "business" });
    expect(props.signedIn).toEqual({ email: "ada@acme.test", state: "personal" });
    expect(props.initialTab).toBe("create");
  });

  it("offers a new confirmation link after an expired one", async () => {
    session({ user: null, member: null, accountType: null });
    const props = await render({ error: "confirmation_failed" });
    expect(props.offerResend).toBe(true);
    expect(props.initialError).toContain("expired");
    expect(props.signedIn).toBeNull();
  });

  it("explains a cancelled Google sign-in without mentioning confirmation links", async () => {
    session({ user: null, member: null, accountType: null });
    const props = await render({ error: "oauth_cancelled" });
    expect(props.offerResend).toBe(false);
    expect(props.initialError).toContain("Google sign-in was cancelled");
  });

  it("ignores unknown error codes", async () => {
    session({ user: null, member: null, accountType: null });
    expect((await render({ error: "<script>" })).initialError).toBeNull();
  });
});
