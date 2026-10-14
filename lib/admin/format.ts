const LAGOS = "Africa/Lagos";

export const PERIODS = ["7d", "30d", "90d", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

export function parsePeriod(value: unknown, fallback: Period = "30d"): Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value) ? (value as Period) : fallback;
}

/** The ISO start of a period, or null for all time. */
export function periodSince(period: Period, now = new Date()): string | null {
  if (period === "all") return null;
  const days = Number.parseInt(period, 10);
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function formatCount(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("en-NG");
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;
}

/** A ratio as a percentage; null when the denominator is zero. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: LAGOS });
}

export function formatAdminDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: LAGOS,
  });
}

/** The last eight characters, upper-cased — how customers see order numbers. */
export function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

export function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
