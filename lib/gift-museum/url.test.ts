import { describe, expect, it } from "vitest";
import {
  canonicalizeProductUrl,
  detectMerchant,
  hashCanonicalUrl,
  slugifyGiftTitle,
} from "@/lib/gift-museum/url";

describe("gift museum URL helpers", () => {
  it("canonicalizes product URLs by removing tracking params and sorting query", () => {
    expect(
      canonicalizeProductUrl(
        "http://www.jumia.com.ng/product/abc/?utm_source=ig&b=2&a=1#reviews"
      )
    ).toBe("https://jumia.com.ng/product/abc?a=1&b=2");
  });

  it("detects common merchants from hostnames", () => {
    expect(detectMerchant("https://www.konga.com/product/1")).toEqual({
      key: "konga",
      label: "Konga",
    });
    expect(detectMerchant("https://merchant.example/products/1")).toEqual({
      key: "generic",
      label: "merchant.example",
    });
  });

  it("hashes canonical URLs deterministically", () => {
    const canonicalUrl = "https://temu.com/item/123";

    expect(hashCanonicalUrl(canonicalUrl)).toBe(hashCanonicalUrl(canonicalUrl));
    expect(hashCanonicalUrl(canonicalUrl)).toHaveLength(64);
  });

  it("builds stable public slugs from titles and URL hashes", () => {
    expect(slugifyGiftTitle("Red Silk Dress!", "abcdef123456")).toBe(
      "red-silk-dress-abcdef12"
    );
  });
});
