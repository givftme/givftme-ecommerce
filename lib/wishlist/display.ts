import { formatPrice } from "@/lib/utils";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";
import type { WishlistVisibility } from "@/lib/wishlist/types";

const VISIBILITY_LABELS: Record<WishlistVisibility, string> = {
  private: "Private",
  friends_family: "Friends & Family",
  public: "Public",
};

export function getVisibilityLabel(visibility: WishlistVisibility) {
  return VISIBILITY_LABELS[visibility];
}

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

export function getDisplayName(name: string | null | undefined) {
  return name?.trim() || "Someone";
}

export function getInitials(name: string | null | undefined) {
  const displayName = getDisplayName(name);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "G";
}

export function getAvatarColorClass(userId: string) {
  const palette = [
    "bg-brand-light text-brand",
    "bg-surface text-muted",
    "bg-red-50 text-red-600",
    "bg-green-50 text-green-700",
    "bg-amber-50 text-amber-700",
  ];
  const total = [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return palette[total % palette.length];
}

export function getOccasionLabel(title: string | null | undefined) {
  return title?.trim() || "wishlist";
}

export type CountdownTone = "green" | "amber" | "red" | "today" | "passed";

export function getCountdownTone(
  occasionDate: string | null | undefined
): CountdownTone | null {
  if (!occasionDate) {
    return null;
  }

  const days = daysFromToday(occasionDate);

  if (days < 0) {
    return "passed";
  }

  if (days === 0) {
    return "today";
  }

  if (days <= 3) {
    return "red";
  }

  if (days <= 7) {
    return "amber";
  }

  return "green";
}

export function getDaysToGoCopy(occasionDate: string | null | undefined) {
  if (!occasionDate) {
    return null;
  }

  const days = daysFromToday(occasionDate);

  if (days < 0) {
    return "Passed";
  }

  if (days === 0) {
    return "Today!";
  }

  return days === 1 ? "1 day to go" : `${days} days to go`;
}

export function getReminderScheduleCopy(
  occasionTitle: string,
  occasionDate: string
) {
  return `We'll remind you 2 weeks and 3 days before ${occasionTitle} on ${formatOccasionDate(occasionDate)}.`;
}

/**
 * Item counts must come from the items themselves, never from the existence of
 * the wishlist container. Deletion is a soft delete (`status: 'archived'`, see
 * the item DELETE handler), so an archived row still exists and would otherwise
 * keep counting after the owner removed it. This mirrors the archived filter in
 * `getOwnedWishlistDetail` and the visible count in `WishlistItemList`, so every
 * owner-facing surface reports the same number.
 */
export function countVisibleWishlistItems(
  items: Array<{ status?: string | null }> | null | undefined,
): number {
  if (!items) {
    return 0;
  }

  return items.filter((item) => (item.status || "available") !== "archived")
    .length;
}
