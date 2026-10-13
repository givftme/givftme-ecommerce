import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampPercent,
  formatContributorCount,
  getCountdownLabel,
  isHttpsUrl,
  isValidWishlistShareKey,
} from "./format";

describe("getCountdownLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 10, 0, 0));
  });

  afterEach(() => vi.useRealTimers());

  it("counts down to a future occasion", () => {
    expect(getCountdownLabel("2026-10-27")).toBe("In 14 days");
    expect(getCountdownLabel("2026-10-14")).toBe("In 1 day");
  });

  it("marks an occasion happening today", () => {
    expect(getCountdownLabel("2026-10-13")).toBe("Today!");
  });

  it("never shows a negative number for a past occasion", () => {
    expect(getCountdownLabel("2026-10-01")).toBe("Passed");
  });

  it("is empty without an occasion date", () => {
    expect(getCountdownLabel(null)).toBeNull();
    expect(getCountdownLabel(undefined)).toBeNull();
  });
});

describe("clampPercent", () => {
  it.each([
    [0, 0],
    [50_000, 50],
    [100_000, 100],
    [105_000, 100],
  ])("clamps %i raised of 100000 to %i%%", (raised, expected) => {
    expect(clampPercent(raised, 100_000)).toBe(expected);
  });

  it("never goes below zero or divides by zero", () => {
    expect(clampPercent(-10, 100)).toBe(0);
    expect(clampPercent(10, 0)).toBe(100);
    expect(clampPercent(0, 0)).toBe(0);
  });
});

describe("isValidWishlistShareKey", () => {
  it("accepts wishlist UUIDs and hex invite tokens", () => {
    expect(isValidWishlistShareKey("3f2a9c1e-8b7d-4e6f-a5b4-c3d2e1f0a9b8")).toBe(true);
    expect(isValidWishlistShareKey("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidWishlistShareKey("not-a-token")).toBe(false);
    expect(isValidWishlistShareKey("0123456789abcdef")).toBe(false);
    expect(isValidWishlistShareKey("../../etc/passwd")).toBe(false);
  });
});

describe("isHttpsUrl", () => {
  it("only allows absolute https URLs", () => {
    expect(isHttpsUrl("https://cdn.example.test/a.png")).toBe(true);
    expect(isHttpsUrl("http://cdn.example.test/a.png")).toBe(false);
    expect(isHttpsUrl("/images/a.png")).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
  });
});

describe("formatContributorCount", () => {
  it("handles the singular", () => {
    expect(formatContributorCount(1)).toBe("1 person has contributed");
    expect(formatContributorCount(4)).toBe("4 people have contributed");
  });
});
