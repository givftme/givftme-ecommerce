// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingControls } from "./PricingControls";
import type { PolicyPage } from "@/lib/pricing/types";

const initial: PolicyPage = { policies: [{ key: "linked", revision: 0, active_version_id: null, active_version: null }], history: [], next_cursor: null };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

async function input(id: string, value: string) {
  const element = container.querySelector<HTMLInputElement>("#" + id)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("pricing operator review", () => {
  it("requires a preview and invalidates it when a reviewed field changes", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      calculation: { gift_price_ngn: "11000", delivery_ngn: null, total_ngn: null },
      preview_token: "signed-preview", expires_at: "2026-09-28T12:10:00Z",
    }) });
    vi.stubGlobal("fetch", fetch);
    await act(async () => root.render(createElement(PricingControls, { initial })));
    expect(container.textContent).toContain("No rate published");
    expect(container.textContent).not.toContain("Publish reviewed rate");
    await input("pricing-linked-rate", "10");
    await input("pricing-linked-reason", "Supplier margin review");
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Publish reviewed rate");
    expect(container.textContent).toContain("Awaiting confirmation");
    await input("pricing-linked-rate", "11");
    expect(container.textContent).not.toContain("Publish reviewed rate");
  });
  it("renders a retry state when pricing records cannot load", async () => {
    await act(async () => root.render(createElement(PricingControls, { initial: null })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("unavailable");
    expect(container.textContent).toContain("Retry loading");
  });
});
