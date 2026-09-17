// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountShell } from "./AccountShell";

const auth = vi.hoisted(() => ({ signOut: vi.fn(), getSession: vi.fn() }));
const route = vi.hoisted(() => ({ pathname: "/account" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
const replace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const browserWindow = window;
  vi.stubGlobal("window", new Proxy(browserWindow, {
    get(target, key) {
      return key === "location" ? { replace } : Reflect.get(target, key);
    },
  }));
  route.pathname = "/account";
  auth.signOut.mockResolvedValue({ error: null });
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderShell() {
  const props = {
    name: "Ada", email: "ada@example.test", avatarUrl: null,
    children: React.createElement("h1", null, "Account content"),
  };
  await act(async () => root.render(React.createElement(AccountShell, props)));
}

describe("Account navigation", () => {
  it("offers the four destinations and sign out as an action", async () => {
    await renderShell();
    const links = [...container.querySelectorAll("nav a")];
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/account/profile", "/account/orders", "/account/notifications", "/account/security",
    ]);
    expect(container.textContent).toContain("ada@example.test");
    expect(container.querySelector("button")?.textContent).toContain("Sign out");
    expect(container.textContent).not.toMatch(/delete account/i);
    expect(container.querySelector('[aria-current="page"]')).toBeNull();
  });

  it.each(["profile", "orders", "orders/owned-order", "notifications", "security"])(
    "marks the parent section active on %s and offers a return to Account", async path => {
      route.pathname = `/account/${path}`;
      await renderShell();
      expect(container.querySelector('[aria-current="page"]')?.getAttribute("href"))
        .toBe(`/account/${path.split("/")[0]}`);
      expect(container.querySelector('a[href="/account"]')?.textContent).toContain("Back to Account");
    },
  );
});

describe("Account sign out", () => {
  it("blocks repeated clicks and waits for session termination before leaving", async () => {
    let finish!: (value: { error: null }) => void;
    auth.signOut.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await renderShell();
    const button = container.querySelector("button")!;
    await act(async () => { button.click(); button.click(); });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Signing out");
    expect(replace).not.toHaveBeenCalled();
    await act(async () => finish({ error: null }));
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("keeps failed sign out retryable without navigating", async () => {
    auth.signOut.mockResolvedValueOnce({ error: new Error("Offline") });
    await renderShell();
    const button = container.querySelector("button")!;
    await act(async () => button.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't sign out");
    expect(button.disabled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    await act(async () => button.click());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it.each([
    { data: { session: { access_token: "still-active" } }, error: null },
    { data: { session: null }, error: new Error("Session unavailable") },
  ])("does not report success when session removal is unconfirmed", async result => {
    auth.getSession.mockResolvedValue(result);
    await renderShell();
    await act(async () => container.querySelector("button")!.click());
    expect(replace).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
