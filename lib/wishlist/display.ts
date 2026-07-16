import { formatPrice } from "@/lib/utils";

export function getSourceDomain(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function formatWishlistPrice(price: number | null) {
  if (price == null || price <= 0) {
    return "Price not listed";
  }

  return formatPrice(price);
}
