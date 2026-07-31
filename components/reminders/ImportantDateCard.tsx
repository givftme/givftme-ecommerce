"use client";

import { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Badge } from "@/components/ui/Badge";
import { OCCASION_EMOJIS, OCCASION_LABELS } from "@/lib/occasion/constants";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";
import type { ImportantDate } from "@/lib/important-dates/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

function DaysPill({ date }: { date: ImportantDate }) {
  const days = daysFromToday(date.date);

  if (days === 0) {
    return <Badge variant="sale">Today! 🎉</Badge>;
  }

  if (days > 0) {
    return (
      <span className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
        In {days} {days === 1 ? "day" : "days"}
      </span>
    );
  }

  const daysAgo = Math.abs(days);
  return (
    <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
      {daysAgo} {daysAgo === 1 ? "day" : "days"} ago
    </span>
  );
}

export function ImportantDateCard({
  date,
  index,
  onEdit,
  onDelete,
}: {
  date: ImportantDate;
  index: number;
  onEdit: (date: ImportantDate) => void;
  onDelete: (date: ImportantDate) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        opacity: 0,
        y: 20,
        delay: index * 0.06,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <article
      ref={ref}
      className="relative rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-[32px]">
          {OCCASION_EMOJIS[date.occasion_type]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{date.person_name}</p>
          <p className="mt-1 text-xs text-muted">
            {OCCASION_LABELS[date.occasion_type]} ·{" "}
            {formatOccasionDate(date.date)}
            {date.is_recurring ? " · Recurs annually" : ""}
          </p>
          {date.linked_wishlist_id && (
            <span className="mt-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
              Wishlist linked
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DaysPill date={date} />
          <button
            type="button"
            aria-label="Date options"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className={cn(
            "absolute right-4 top-16 z-20 w-36 rounded-2xl border border-stone-100 bg-white p-2 shadow-lg"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onEdit(date);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-brand-light hover:text-brand"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete(date);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
