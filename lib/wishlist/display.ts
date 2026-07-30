import { formatPrice } from "@/lib/utils";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";

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
