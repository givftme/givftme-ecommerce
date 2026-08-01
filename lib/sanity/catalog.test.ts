import { describe, expect, it } from "vitest";
import {
  getProductDisplayPrice,
  isFlashSaleActive,
  isSearchableQuery,
  sanitizeSearchQuery,
} from "./catalog";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const PAST = new Date("2026-07-01T00:00:00.000Z").toISOString();
const FUTURE = new Date("2026-09-01T00:00:00.000Z").toISOString();

describe("isFlashSaleActive", () => {
  it("is false without sale fields", () => {
    expect(isFlashSaleActive({}, NOW)).toBe(false);
  });

  it("is false outside the sale window", () => {
    expect(
      isFlashSaleActive(
        { salePrice: 5000, saleStartTime: FUTURE, saleEndTime: FUTURE },
        NOW
      )
    ).toBe(false);
  });

  it("is true inside the sale window", () => {
    expect(
      isFlashSaleActive(
        { salePrice: 5000, saleStartTime: PAST, saleEndTime: FUTURE },
        NOW
      )
    ).toBe(true);
  });
});

describe("getProductDisplayPrice", () => {
  it("returns the base price when there is no sale", () => {
    const result = getProductDisplayPrice({ price: 10000 }, NOW);

    expect(result).toEqual({
      price: 10000,
      compareAtPrice: null,
      isOnFlashSale: false,
      saleEndTime: null,
    });
  });

  it("returns the sale price and compareAtPrice during an active sale", () => {
    const result = getProductDisplayPrice(
      {
        price: 10000,
        salePrice: 7000,
        saleStartTime: PAST,
        saleEndTime: FUTURE,
      },
      NOW
    );

    expect(result.price).toBe(7000);
    expect(result.compareAtPrice).toBe(10000);
    expect(result.isOnFlashSale).toBe(true);
  });

  it("returns the base price after the sale window ends", () => {
    const result = getProductDisplayPrice(
      {
        price: 10000,
        salePrice: 7000,
        saleStartTime: PAST,
        saleEndTime: PAST,
      },
      NOW
    );

    expect(result.price).toBe(10000);
    expect(result.isOnFlashSale).toBe(false);
  });

  it("clamps a salePrice that is higher than the base price (data-entry error)", () => {
    const result = getProductDisplayPrice(
      {
        price: 10000,
        salePrice: 15000,
        saleStartTime: PAST,
        saleEndTime: FUTURE,
      },
      NOW
    );

    expect(result.price).toBe(10000);
  });
});

describe("sanitizeSearchQuery", () => {
  it("strips quotes, asterisks, and backslashes", () => {
    expect(sanitizeSearchQuery('a"b*c\\d')).toBe("abcd");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeSearchQuery("  candles  ")).toBe("candles");
  });

  it("leaves an ordinary query untouched", () => {
    expect(sanitizeSearchQuery("scented candle")).toBe("scented candle");
  });
});

describe("isSearchableQuery", () => {
  it("rejects queries shorter than 2 characters", () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery("a")).toBe(false);
  });

  it("accepts queries of 2 or more characters", () => {
    expect(isSearchableQuery("ab")).toBe(true);
    expect(isSearchableQuery("candle")).toBe(true);
  });
});
