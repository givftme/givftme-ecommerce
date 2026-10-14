export type EventDevice = "mobile" | "tablet" | "desktop";

export interface EventRequestContext {
  device: EventDevice | null;
  city: string | null;
  /** ISO 3166-1 alpha-2. Null lets the column default ('NG') apply. */
  country: string | null;
}

export function deviceFromUserAgent(userAgent: string | null | undefined): EventDevice | null {
  if (!userAgent) return null;
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

// Vercel's edge sets these from the visitor's IP. Locally they are absent.
export function eventContextFromHeaders(headers: Headers): EventRequestContext {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  return {
    device: deviceFromUserAgent(headers.get("user-agent")),
    city: decodeHeader(headers.get("x-vercel-ip-city")),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

/** A wishlist id when a signup's return path is a shared list (`/w/<id>`). */
export function referrerListIdFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = /^\/w\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i.exec(path);
  return match ? match[1].toLowerCase() : null;
}

export function priceBand(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  if (price < 10_000) return "under_10k";
  if (price < 25_000) return "10k_25k";
  if (price < 50_000) return "25k_50k";
  if (price < 100_000) return "50k_100k";
  return "100k_plus";
}

/** Whole Lagos calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  const lagosDay = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return Date.parse(`${parts}T00:00:00Z`);
  };
  return Math.round((lagosDay(to) - lagosDay(from)) / 86_400_000);
}
