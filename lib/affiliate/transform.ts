export interface AffiliateTransformResult {
  affiliateUrl: string;
  network: "jumia" | "amazon" | "konga" | "generic";
}

function withSearchParam(url: URL, key: string, value: string) {
  url.searchParams.set(key, value);
  return url.toString();
}

export function buildAffiliateUrl(productUrl: string): AffiliateTransformResult {
  const url = new URL(productUrl);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host.includes("jumia.")) {
    const affiliateId = process.env.JUMIA_AFFILIATE_ID;

    return {
      affiliateUrl: affiliateId
        ? withSearchParam(url, "tag", affiliateId)
        : withSearchParam(url, "utm_source", "gifvtme"),
      network: "jumia",
    };
  }

  if (host.includes("amazon.")) {
    const affiliateId = process.env.AMAZON_AFFILIATE_ID;

    return {
      affiliateUrl: affiliateId
        ? withSearchParam(url, "tag", affiliateId)
        : withSearchParam(url, "utm_source", "gifvtme"),
      network: "amazon",
    };
  }

  if (host.includes("konga.")) {
    const affiliateId = process.env.KONGA_AFFILIATE_ID;

    return {
      affiliateUrl: affiliateId
        ? withSearchParam(url, "k_id", affiliateId)
        : withSearchParam(url, "utm_source", "gifvtme"),
      network: "konga",
    };
  }

  return {
    affiliateUrl: withSearchParam(url, "utm_source", "gifvtme"),
    network: "generic",
  };
}
