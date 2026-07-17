import {
  OCCASION_EMOJIS,
  OCCASION_LABELS,
} from "@/lib/occasion/constants";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";
import type { OccasionRecord } from "@/lib/occasion/types";

function getCountdown(occasion: OccasionRecord) {
  if (occasion.status === "archived") {
    return "Archived";
  }

  const days = daysFromToday(occasion.occasion_date);

  if (days === 0) {
    return "Today! 🎉";
  }

  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"} to go`;
  }

  const daysAgo = Math.abs(days);
  return `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
}

export function OccasionHero({
  occasion,
  itemCount,
}: {
  occasion: OccasionRecord;
  itemCount: number;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-[40px]">
          {OCCASION_EMOJIS[occasion.occasion_type]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand">
            {OCCASION_LABELS[occasion.occasion_type]}
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-ink">
            {occasion.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatOccasionDate(occasion.occasion_date)} · {getCountdown(occasion)}
          </p>
        </div>
      </div>
      <p className="mt-5 text-sm font-medium text-ink">
        {itemCount} {itemCount === 1 ? "item" : "items"} total
      </p>
    </section>
  );
}
