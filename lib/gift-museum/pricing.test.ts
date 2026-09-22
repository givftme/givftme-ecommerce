import { describe, expect, it, vi } from "vitest";
import {
  estimateMarkupPrice,
  getMarkupDefaults,
  normalizeCurrency,
  roundUpToNearest,
} from "@/lib/gift-museum/pricing";

describe("gift museum pricing helpers", () => {
  it("rounds up to the requested increment", () => {
    expect(roundUpToNearest(17401, 500)).toBe(17500);
    expect(roundUpToNearest(17500, 500)).toBe(17500);
  });

  it("estimates markup using source NGN plus percent and delivery buffer", () => {
    expect(estimateMarkupPrice(10000, null)).toMatchObject({
      basePriceNgn: 10000,
      markupPercent: 25,
      deliveryBufferNgn: 5000,
      roundingNgn: 500,
      recommendedPriceNgn: 17500,
    });
  });

  it("uses converted NGN when available", () => {
    expect(estimateMarkupPrice(10, 16000).recommendedPriceNgn).toBe(25000);
  });

  it("reads optional environment defaults", () => {
    vi.stubEnv("FETCH_MARKUP_PERCENT", "10");
    vi.stubEnv("FETCH_DELIVERY_BUFFER_NGN", "1500");
    vi.stubEnv("FETCH_ROUNDING_NGN", "1000");

    expect(getMarkupDefaults()).toEqual({
      markupPercent: 10,
      deliveryBufferNgn: 1500,
      roundingNgn: 1000,
    });

    vi.unstubAllEnvs();
  });

  it("normalizes empty currency values to NGN", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
    expect(normalizeCurrency("")).toBe("NGN");
  });
});
