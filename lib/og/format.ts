import { z } from "zod";
import { daysFromToday } from "@/lib/occasion/date";

const uuidSchema = z.string().uuid();
// wishlist_invites.token defaults to encode(gen_random_bytes(16), 'hex').
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{32}$/i;

/** A shared wishlist key is either an invite token or the wishlist's UUID. */
export function isValidWishlistShareKey(value: string) {
  return INVITE_TOKEN_PATTERN.test(value) || uuidSchema.safeParse(value).success;
}

export function isHttpsUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

export function getCountdownLabel(occasionDate: string | null | undefined) {
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

  return days === 1 ? "In 1 day" : `In ${days} days`;
}

/** Progress as a whole percentage, clamped to 0–100 even if data is off. */
export function clampPercent(raised: number, target: number) {
  if (!Number.isFinite(raised) || !Number.isFinite(target) || target <= 0) {
    return raised > 0 ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Math.round((raised / target) * 100)));
}

export function formatContributorCount(count: number) {
  return `${count} ${count === 1 ? "person has" : "people have"} contributed`;
}
