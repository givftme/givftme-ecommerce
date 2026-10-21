import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  ACCOUNT_INCOMPLETE_MESSAGE,
  EMAIL_IN_USE_MESSAGE,
  NOT_BUSINESS_MESSAGE,
  signInBusiness,
  signUpBusiness,
} from "@/lib/business-dashboard/account";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/env", () => ({ getAppUrl: () => "https://givftme.test" }));
vi.mock("@/lib/events/server", () => ({ recordRequestEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const membership = vi.fn();
const profile = vi.fn();
const rpc = vi.fn();

const values = { email: "hr@acme.test", password: "correct horse" };

/** business_users and users answer from their own mocks. */
function table(name: string) {
  const result = name === "business_users" ? membership : profile;
  const query = { select: () => query, eq: () => query, limit: () => query, maybeSingle: () => result() };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers() as unknown as Awaited<ReturnType<typeof headers>>);
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword, signUp, signOut },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(createServiceClient).mockReturnValue({
    from: table,
    rpc,
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  } as unknown as ReturnType<typeof createServiceClient>);
  membership.mockResolvedValue({ data: null, error: null });
  profile.mockResolvedValue({ data: { account_type: "consumer" }, error: null });
});

describe("signInBusiness", () => {
  it("tells an unconfirmed sign-up to confirm, with a code the screen can act on", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    const result = await signInBusiness(values);
    expect(result).toMatchObject({ ok: false, status: 403, code: "email_not_confirmed" });
  });

  it("keeps wrong credentials generic", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    const result = await signInBusiness(values);
    expect(result).toEqual({ ok: false, status: 401, error: "Incorrect email or password." });
  });

  it("signs a personal account out of this device only, and explains the accounts are separate", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "customer" } }, error: null });
    const result = await signInBusiness(values);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ ok: false, status: 403, error: NOT_BUSINESS_MESSAGE, code: "not_business" });
  });

  it("doesn't send a personal account to create one with the same email", () => {
    expect(NOT_BUSINESS_MESSAGE).toContain("different (work) email");
    expect(EMAIL_IN_USE_MESSAGE).toContain("different (work) email");
  });

  it.each([
    ["a business account type without a membership", null, "business"],
    ["a membership without the business account type", { id: "membership" }, "consumer"],
  ])("reports %s as an incomplete account, not a personal one", async (_case, member, accountType) => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "hr" } }, error: null });
    membership.mockResolvedValue({ data: member, error: null });
    profile.mockResolvedValue({ data: { account_type: accountType }, error: null });
    const result = await signInBusiness(values);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ ok: false, status: 403, error: ACCOUNT_INCOMPLETE_MESSAGE, code: "account_incomplete" });
  });

  it("doesn't call a member personal when the membership lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signInWithPassword.mockResolvedValue({ data: { user: { id: "hr" } }, error: null });
    membership.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const result = await signInBusiness(values);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(result).not.toHaveProperty("code");
  });

  it("sends members to the dashboard", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "hr" } }, error: null });
    membership.mockResolvedValue({ data: { id: "membership" }, error: null });
    profile.mockResolvedValue({ data: { account_type: "business" }, error: null });
    expect(await signInBusiness(values)).toEqual({ ok: true, redirectTo: "/business-dashboard", needsConfirmation: false });
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("signUpBusiness", () => {
  const signup: Parameters<typeof signUpBusiness>[0] = { ...values, companyName: "Acme", role: "HR / People" };

  it("explains an email already in use without suggesting the same email again", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "existing", identities: [] }, session: null }, error: null });
    expect(await signUpBusiness(signup)).toEqual({ ok: false, status: 409, error: EMAIL_IN_USE_MESSAGE });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("signs a half-made account out of this device only before removing it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signUp.mockResolvedValue({ data: { user: { id: "new", identities: [{}] }, session: {} }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "failed" } });
    expect(await signUpBusiness(signup)).toMatchObject({ ok: false, status: 500 });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
