import { createHash } from "node:crypto";

export interface MerchantInfo {
  key: string;
  label: string;
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "igshid",
  "tag",
  "ascsubtag",
  "affiliate",
  "affid",
  "ref",
  "ref_",
  "spm",
]);

const MERCHANTS: Array<{ key: string; label: string; hosts: string[] }> = [
  { key: "jumia", label: "Jumia", hosts: ["jumia."] },
  { key: "konga", label: "Konga", hosts: ["konga."] },
  { key: "temu", label: "Temu", hosts: ["temu."] },
  { key: "shein", label: "Shein", hosts: ["shein."] },
  { key: "amazon", label: "Amazon", hosts: ["amazon."] },
  { key: "instagram", label: "Instagram", hosts: ["instagram.", "instagr.am"] },
];

export function detectMerchant(rawUrl: string): MerchantInfo {
  const host = new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  const match = MERCHANTS.find((merchant) =>
    merchant.hosts.some((needle) => host.includes(needle))
  );

  if (match) {
    return { key: match.key, label: match.label };
  }

  return {
    key: "generic",
    label: host.split(".").slice(-2).join(".") || "Merchant",
  };
}

export function canonicalizeProductUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.protocol = "https:";
  url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  url.hash = "";

  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }

  const sortedParams = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  url.search = "";
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function hashCanonicalUrl(canonicalUrl: string) {
  return createHash("sha256").update(canonicalUrl).digest("hex");
}

export function slugifyGiftTitle(title: string, fallback: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `${slug || "gift"}-${fallback.slice(0, 8)}`;
}
