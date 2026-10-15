// Privacy rules from 23-ADMIN-DASHBOARD-SPEC.md, enforced in code.

/** Rule 1: no exported aggregate may describe fewer than this many people. */
export const MIN_AGGREGATE_SIZE = 50;

/** Rule 3: never in a segment export or a messaging query. */
export const SENSITIVE_OCCASION_TYPES = ["remembrance", "sympathy"] as const;

export function isSensitiveOccasion(type: string | null | undefined) {
  return Boolean(type && (SENSITIVE_OCCASION_TYPES as readonly string[]).includes(type.toLowerCase()));
}

/** Rule 1: an export's rows, or none at all when the group is too small. */
export function suppressSmallGroup<T>(rows: T[]): { rows: T[]; suppressed: boolean } {
  return rows.length < MIN_AGGREGATE_SIZE ? { rows: [], suppressed: true } : { rows, suppressed: false };
}

/** "Adaeze Okafor" → "A.O." — for tables that rank people's lists. */
export function maskToInitials(name: string | null | undefined) {
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `${part[0]!.toUpperCase()}.`)
    .join("");
  return initials || "—";
}
