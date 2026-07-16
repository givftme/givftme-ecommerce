export interface ScrapedProduct {
  title: string;
  image_url: string | null;
  price: number | null;
  currency: string;
  product_url: string;
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

function parsePrice(amount: number | string | undefined) {
  if (amount == null) {
    return null;
  }

  const price = typeof amount === "number" ? amount : Number.parseFloat(amount);

  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function scrapeProductUrl(productUrl: string): Promise<ScrapedProduct> {
  const apiUrl = new URL("https://api.microlink.io");
  apiUrl.searchParams.set("url", productUrl);
  apiUrl.searchParams.set("meta", "false");
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
    price: parsePrice(data.price?.amount),
    currency: data.price?.currency || "NGN",
    product_url: data.url || productUrl,
  };
}
