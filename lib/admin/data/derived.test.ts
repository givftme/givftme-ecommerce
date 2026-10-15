import { describe, expect, it } from "vitest";
import { accountHealth } from "@/lib/admin/data/corporate";
import { buildFunnel } from "@/lib/admin/data/growth";
import { deriveWishlistMetrics } from "@/lib/admin/data/insights";
import { estimateLtv, streakMonths } from "@/lib/admin/data/people";
import { adminNextStatuses, orderStatusUpdateSchema, payoutUpdateSchema } from "@/lib/admin/validation";

const NOW = new Date("2026-10-14T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("buildFunnel", () => {
  it("computes drop-off from the previous step", () => {
    const steps = buildFunnel({ signed_up: 200, saved_one_date: 150, saved_three_dates: 60, created_wishlist: 60, shared_link: 0, first_order: 0, second_order: 0 });
    expect(steps.map((step) => step.users)).toEqual([200, 150, 60, 60, 0, 0, 0]);
    expect(steps[0]!.dropOff).toBeNull();
    expect(steps[1]!.dropOff).toBe(25);
    expect(steps[3]!.dropOff).toBe(0);
    expect(steps[4]!.dropOff).toBe(100);
    // Nothing to lose after an empty step.
    expect(steps[5]!.dropOff).toBeNull();
  });
});

describe("deriveWishlistMetrics", () => {
  it("derives rates and the K-factor", () => {
    const metrics = deriveWishlistMetrics({
      lists_created: 40, avg_items_per_list: 3, items_total: 120, items_no_price: 10,
      source: { catalog: 1, external_scraped: 2, external_manual: 3, external_untracked: 4 },
      lists_shared: 10, shares: 20, opens: 80, claims: 8, attributed_signups: 5,
    });
    expect(metrics.shareRate).toBe(25);
    expect(metrics.opensPerShare).toBe(4);
    expect(metrics.claimsPerOpen).toBe(0.1);
    expect(metrics.kFactor).toBe(0.5);
  });

  it("returns null rates instead of dividing by zero", () => {
    const metrics = deriveWishlistMetrics({
      lists_created: 0, avg_items_per_list: 0, items_total: 0, items_no_price: 0,
      source: { catalog: 0, external_scraped: 0, external_manual: 0, external_untracked: 0 },
      lists_shared: 0, shares: 0, opens: 0, claims: 0, attributed_signups: 0,
    });
    expect([metrics.shareRate, metrics.opensPerShare, metrics.claimsPerOpen, metrics.kFactor]).toEqual([null, null, null, null]);
  });
});

describe("person value helpers", () => {
  it("counts streak months from the later of first save or last miss", () => {
    expect(streakMonths(null, null, NOW)).toBeNull();
    expect(streakMonths("2026-01-20T00:00:00Z", null, NOW)).toBe(8);
    expect(streakMonths("2026-01-20T00:00:00Z", "2026-09-01T00:00:00Z", NOW)).toBe(1);
    expect(streakMonths("2026-10-01T00:00:00Z", null, NOW)).toBe(0);
  });

  it("projects lifetime value over 24 months", () => {
    expect(estimateLtv(0, daysAgo(90), NOW)).toBeNull();
    expect(estimateLtv(30_000, daysAgo(3), NOW)).toBeNull();
    // About three months at ₦10,000 a month.
    expect(estimateLtv(30_000, daysAgo(91.32), NOW)).toBe(240_000);
  });
});

describe("accountHealth", () => {
  it("grades accounts by days since their last order", () => {
    expect(accountHealth(daysAgo(10), daysAgo(200), NOW)).toBe("healthy");
    expect(accountHealth(daysAgo(90), daysAgo(200), NOW)).toBe("drifting");
    expect(accountHealth(daysAgo(150), daysAgo(200), NOW)).toBe("at-risk");
    expect(accountHealth(null, daysAgo(10), NOW)).toBe("healthy");
    expect(accountHealth(null, daysAgo(90), NOW)).toBe("at-risk");
  });
});

describe("admin order transitions", () => {
  it("never offers payment states to a person", () => {
    expect(adminNextStatuses("pending_payment")).toEqual(["cancelled"]);
    expect(adminNextStatuses("payment_failed")).toEqual(["cancelled"]);
    expect(adminNextStatuses("confirmed")).toEqual(["under_review", "cancelled"]);
    expect(adminNextStatuses("shipped")).toEqual(["delivered", "cancelled"]);
    expect(adminNextStatuses("delivered")).toEqual(["refunded"]);
    expect(adminNextStatuses("refunded")).toEqual([]);
  });

  it("rejects payment states and non-http tracking links in the request", () => {
    expect(orderStatusUpdateSchema.safeParse({ status: "confirmed" }).success).toBe(false);
    expect(orderStatusUpdateSchema.safeParse({ status: "shipped", tracking_url: "javascript:alert(1)" }).success).toBe(false);
    const parsed = orderStatusUpdateSchema.parse({ status: "shipped", tracking_number: " GIG123 ", tracking_url: "", notes: "" });
    expect(parsed).toEqual({ status: "shipped", tracking_number: "GIG123", carrier_name: null, tracking_url: null, notes: null });
  });

  it("requires full transfer details to complete a payout", () => {
    expect(payoutUpdateSchema.safeParse({ status: "processing" }).success).toBe(true);
    expect(payoutUpdateSchema.safeParse({ status: "completed", bank_name: "GTBank", account_number: "123", account_name: "Ada", reference: "TRF1" }).success).toBe(false);
    expect(payoutUpdateSchema.safeParse({ status: "completed", bank_name: "GTBank", account_number: "0123456789", account_name: "Ada Obi", reference: "TRF-001" }).success).toBe(true);
  });
});
