import { describe, expect, it } from "vitest";
import { getActivePrice, isFlashSaleWindowActive } from "./getActivePrice";
import type { SanityCheckoutProduct } from "./getActivePrice";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const PAST = new Date("2026-07-01T00:00:00.000Z").toISOString();
const FUTURE = new Date("2026-09-01T00:00:00.000Z").toISOString();

function baseProduct(overrides: Partial<SanityCheckoutProduct> = {}): SanityCheckoutProduct {
  return {
    _id: "product-1",
    hasVariants: false,
    basePrice: 10000,
    salePrice: null,
    saleStartTime: null,
    saleEndTime: null,
    variants: [],
    ...overrides,
  };
}

describe("getActivePrice", () => {
  it("returns basePrice when there is no sale", () => {
    const product = baseProduct();

    expect(getActivePrice(product, null)).toBe(10000);
  });

  it("returns salePrice when a sale is active", () => {
    const product = baseProduct({
      salePrice: 7000,
      saleStartTime: PAST,
      saleEndTime: FUTURE,
    });

    expect(getActivePrice(product, null, NOW)).toBe(7000);
  });

  it("returns basePrice when the sale window has expired", () => {
    const product = baseProduct({
      salePrice: 7000,
      saleStartTime: PAST,
      saleEndTime: PAST,
    });

    expect(getActivePrice(product, null, NOW)).toBe(10000);
  });

  it("returns the selected variant's price when hasVariants and no sale", () => {
    const product = baseProduct({
      hasVariants: true,
      variants: [
        { combinationKey: "red", price: 12000, available: true },
        { combinationKey: "blue", price: 15000, available: true },
      ],
    });

    expect(getActivePrice(product, "blue")).toBe(15000);
  });

  it("returns salePrice for a variant during an active sale", () => {
    const product = baseProduct({
      hasVariants: true,
      salePrice: 9000,
      saleStartTime: PAST,
      saleEndTime: FUTURE,
      variants: [{ combinationKey: "red", price: 12000, available: true }],
    });

    expect(getActivePrice(product, "red", NOW)).toBe(9000);
  });

  it("clamps salePrice to basePrice when salePrice is a data-entry error higher than basePrice", () => {
    const product = baseProduct({
      salePrice: 15000,
      saleStartTime: PAST,
      saleEndTime: FUTURE,
    });

    expect(getActivePrice(product, null, NOW)).toBe(10000);
  });

  it("clamps salePrice to the variant price when higher than the variant price", () => {
    const product = baseProduct({
      hasVariants: true,
      salePrice: 20000,
      saleStartTime: PAST,
      saleEndTime: FUTURE,
      variants: [{ combinationKey: "red", price: 12000, available: true }],
    });

    expect(getActivePrice(product, "red", NOW)).toBe(12000);
  });

  it("throws when the requested variant does not exist", () => {
    const product = baseProduct({
      hasVariants: true,
      variants: [{ combinationKey: "red", price: 12000, available: true }],
    });

    expect(() => getActivePrice(product, "green")).toThrow();
  });
});

describe("isFlashSaleWindowActive", () => {
  it("is false when salePrice is missing", () => {
    expect(
      isFlashSaleWindowActive(
        { salePrice: null, saleStartTime: PAST, saleEndTime: FUTURE },
        NOW
      )
    ).toBe(false);
  });

  it("is false before the sale starts", () => {
    expect(
      isFlashSaleWindowActive(
        { salePrice: 1000, saleStartTime: FUTURE, saleEndTime: FUTURE },
        NOW
      )
    ).toBe(false);
  });

  it("is true within the sale window", () => {
    expect(
      isFlashSaleWindowActive(
        { salePrice: 1000, saleStartTime: PAST, saleEndTime: FUTURE },
        NOW
      )
    ).toBe(true);
  });
});
