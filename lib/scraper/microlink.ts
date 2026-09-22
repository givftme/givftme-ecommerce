import { createServiceClient } from "@/lib/supabase/server";
import { convertToNgn } from "@/lib/gift-museum/fx";
import { estimateMarkupPrice, normalizeCurrency } from "@/lib/gift-museum/pricing";
import {
  canonicalizeProductUrl,
  detectMerchant,
  hashCanonicalUrl,
} from "@/lib/gift-museum/url";
import type { ScrapeConfidence, ScrapeStatus } from "@/lib/gift-museum/types";

export interface ScrapedProduct {
  title: string;
  image_url: string | null;
  description?: string | null;
  price: number | null;
  currency: string;
  product_url: string;
  canonical_url?: string;
  merchant?: string;
  merchant_label?: string;
  scrape_status?: ScrapeStatus;
  scrape_confidence?: ScrapeConfidence;
  converted_price_ngn?: number | null;
  recommended_price_ngn?: number | null;
}

interface MicrolinkImage {
  url?: string;
}

interface MicrolinkPrice {
  amount?: number | string;
  currency?: string;
}

interface MicrolinkResponse {
  status?: string;
  data?: {
    title?: string;
    description?: string;
    image?: MicrolinkImage;
    logo?: MicrolinkImage;
    price?: MicrolinkPrice;
    url?: string;
  };
  message?: string;
}

const SCRAPE_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function parsePrice(amount: number | string | undefined) {
  if (amount == null) {
    return null;
  }

  const price = typeof amount === "number" ? amount : Number.parseFloat(amount);

  return Number.isFinite(price) && price > 0 ? price : null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getMetaContent(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i"
      ),
    ];
    const match = patterns.map((pattern) => html.match(pattern)).find(Boolean);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function getJsonLdProducts(html: string) {
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const products: Record<string, unknown>[] = [];

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (entry && typeof entry === "object") {
          const object = entry as Record<string, unknown>;
          const graph = Array.isArray(object["@graph"]) ? object["@graph"] : [object];
          for (const graphEntry of graph) {
            if (
              graphEntry &&
              typeof graphEntry === "object" &&
              String((graphEntry as Record<string, unknown>)["@type"]).toLowerCase().includes("product")
            ) {
              products.push(graphEntry as Record<string, unknown>);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return products;
}

function getFirstString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return getFirstString(value[0]);
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return getFirstString(object.url || object["@id"]);
  }

  return null;
}

function productFromJsonLd(
  products: Record<string, unknown>[],
  productUrl: string
): Partial<ScrapedProduct> {
  const product = products[0];

  if (!product) {
    return {};
  }

  const offers = Array.isArray(product.offers)
    ? product.offers[0]
    : product.offers;
  const offer = offers && typeof offers === "object" ? offers as Record<string, unknown> : {};
  const price = parsePrice(
    typeof offer.price === "string" || typeof offer.price === "number"
      ? offer.price
      : undefined
  );

  return {
    title: typeof product.name === "string" ? product.name : undefined,
    image_url: getFirstString(product.image),
    description:
      typeof product.description === "string" ? product.description : undefined,
    price,
    currency:
      typeof offer.priceCurrency === "string" ? offer.priceCurrency : undefined,
    product_url: getFirstString(product.url) || productUrl,
  };
}

async function fetchHtmlMetadata(productUrl: string): Promise<Partial<ScrapedProduct>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  try {
    const response = await fetch(productUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; GifvtmeBot/1.0; +https://givftme.vercel.app)",
      },
    });

    if (!response.ok) {
      throw new Error("Metadata page fetch failed.");
    }

    const html = await response.text();
    const jsonLd = productFromJsonLd(getJsonLdProducts(html), productUrl);
    const title =
      jsonLd.title ||
      getMetaContent(html, ["og:title", "twitter:title"]) ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const image =
      jsonLd.image_url ||
      getMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const description =
      jsonLd.description ||
      getMetaContent(html, ["og:description", "twitter:description", "description"]);
    const price =
      jsonLd.price ??
      parsePrice(getMetaContent(html, ["product:price:amount", "og:price:amount"]) || undefined);
    const currency =
      jsonLd.currency ||
      getMetaContent(html, ["product:price:currency", "og:price:currency"]);

    return {
      title: title ? decodeHtml(title) : undefined,
      image_url: image || undefined,
      description: description || undefined,
      price,
      currency: currency || undefined,
      product_url: jsonLd.product_url || productUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMicrolinkMetadata(productUrl: string): Promise<Partial<ScrapedProduct>> {
  const apiUrl = new URL("https://api.microlink.io");
  apiUrl.searchParams.set("url", productUrl);
  apiUrl.searchParams.set("meta", "true");
  apiUrl.searchParams.set("screenshot", "false");

  const headers: HeadersInit = {};

  if (process.env.MICROLINK_API_KEY) {
    headers["x-api-key"] = process.env.MICROLINK_API_KEY;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(apiUrl.toString(), {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error("Microlink could not scrape this URL.");
  }

  const payload = (await response.json()) as MicrolinkResponse;
  const data = payload.data;
  const title = data?.title?.trim();

  if (payload.status !== "success" || !data || !title) {
    throw new Error(payload.message || "Microlink returned no product data.");
  }

  return {
    title,
    image_url: data.image?.url || data.logo?.url || null,
    description: data.description || null,
    price: parsePrice(data.price?.amount),
    currency: data.price?.currency || "NGN",
    product_url: data.url || productUrl,
  };
}

async function readCachedScrape(canonicalUrlHash: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("gift_museum_scrape_cache")
    .select("payload, expires_at")
    .eq("canonical_url_hash", canonicalUrlHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data?.payload) {
    return null;
  }

  return data.payload as ScrapedProduct;
}

async function writeCachedScrape(canonicalUrlHash: string, canonicalUrl: string, product: ScrapedProduct) {
  const supabase = createServiceClient();
  await supabase.from("gift_museum_scrape_cache").upsert(
    {
      canonical_url_hash: canonicalUrlHash,
      canonical_url: canonicalUrl,
      payload: product,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    },
    { onConflict: "canonical_url_hash" }
  );
}

async function enrichPricing(product: ScrapedProduct) {
  const supabase = createServiceClient();
  let convertedPriceNgn: number | null = null;

  try {
    const conversion = await convertToNgn(
      supabase,
      product.price,
      product.currency
    );
    convertedPriceNgn = conversion?.convertedPriceNgn ?? null;
  } catch (error) {
    console.error("Scrape FX conversion failed.", error);
  }

  const markup = estimateMarkupPrice(product.price, convertedPriceNgn);

  return {
    ...product,
    converted_price_ngn: convertedPriceNgn,
    recommended_price_ngn: markup.recommendedPriceNgn,
  };
}

export async function scrapeProductUrl(productUrl: string): Promise<ScrapedProduct> {
  const canonicalUrl = canonicalizeProductUrl(productUrl);
  const canonicalUrlHash = hashCanonicalUrl(canonicalUrl);
  const merchant = detectMerchant(canonicalUrl);
  const cached = await readCachedScrape(canonicalUrlHash);

  if (cached) {
    return cached;
  }

  const attempts: Partial<ScrapedProduct>[] = [];

  for (const fetcher of [fetchMicrolinkMetadata, fetchHtmlMetadata]) {
    try {
      attempts.push(await fetcher(canonicalUrl));
    } catch {
      continue;
    }
  }

  const merged = attempts.reduce<Partial<ScrapedProduct>>(
    (current, attempt) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(attempt).filter(([, value]) => value !== null && value !== undefined && value !== "")
      ),
    }),
    {}
  );
  const title = merged.title?.trim();

  const product: ScrapedProduct = await enrichPricing({
    title: title || merchant.label,
    image_url: merged.image_url || null,
    description: merged.description || null,
    price: merged.price ?? null,
    currency: normalizeCurrency(merged.currency),
    product_url: merged.product_url || productUrl,
    canonical_url: canonicalUrl,
    merchant: merchant.key,
    merchant_label: merchant.label,
    scrape_status: title ? (merged.price != null ? "fetched" : "partial") : "manual",
    scrape_confidence: title && merged.price != null ? "high" : title ? "medium" : "low",
  });

  await writeCachedScrape(canonicalUrlHash, canonicalUrl, product);

  return product;
}
