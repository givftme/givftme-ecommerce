import { describe, expect, it } from "vitest";
import { buildAffiliateUrl } from "./transform";

describe("buildAffiliateUrl", () => {
  it("tags jumia URLs with the affiliate id when configured", () => {
    process.env.JUMIA_AFFILIATE_ID = "jumia-123";

    const result = buildAffiliateUrl("https://www.jumia.com.ng/product");

    expect(result.network).toBe("jumia");
    expect(result.affiliateUrl).toContain("tag=jumia-123");

    delete process.env.JUMIA_AFFILIATE_ID;
  });

  it("falls back to a utm_source param when no jumia affiliate id is set", () => {
    delete process.env.JUMIA_AFFILIATE_ID;

    const result = buildAffiliateUrl("https://jumia.com.ng/product");

    expect(result.network).toBe("jumia");
    expect(result.affiliateUrl).toContain("utm_source=gifvtme");
  });

  it("tags amazon URLs with the affiliate id when configured", () => {
    process.env.AMAZON_AFFILIATE_ID = "amazon-456";

    const result = buildAffiliateUrl("https://www.amazon.com/dp/xyz");

    expect(result.network).toBe("amazon");
    expect(result.affiliateUrl).toContain("tag=amazon-456");

    delete process.env.AMAZON_AFFILIATE_ID;
  });

  it("tags konga URLs with the k_id param when configured", () => {
    process.env.KONGA_AFFILIATE_ID = "konga-789";

    const result = buildAffiliateUrl("https://www.konga.com/product");

    expect(result.network).toBe("konga");
    expect(result.affiliateUrl).toContain("k_id=konga-789");

    delete process.env.KONGA_AFFILIATE_ID;
  });

  it("treats unrecognized hosts as generic", () => {
    const result = buildAffiliateUrl("https://www.example.com/product");

    expect(result.network).toBe("generic");
    expect(result.affiliateUrl).toContain("utm_source=gifvtme");
  });

  it("strips a www. prefix before matching the host", () => {
    const result = buildAffiliateUrl("https://www.jumia.com.ng/product");

    expect(result.network).toBe("jumia");
  });
});
