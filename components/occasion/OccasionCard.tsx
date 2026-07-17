"use client";

import Link from "next/link";
import { useRef } from "react";
import { Eye } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  OCCASION_EMOJIS,
  OCCASION_LABELS,
} from "@/lib/occasion/constants";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";
import type { OccasionSummary } from "@/lib/occasion/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

function DaysPill({ occasion }: { occasion: OccasionSummary }) {
  if (occasion.status === "archived") {
    return <Badge variant="muted">Archived</Badge>;
  }

  const days = daysFromToday(occasion.occasion_date);

  if (days === 0) {
    return <Badge variant="sale">Today! 🎉</Badge>;
  }

  if (days > 0) {
    return (
      <span className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
        {days} {days === 1 ? "day" : "days"} to go
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

export function OccasionCard({
  occasion,
  index,
}: {
  occasion: OccasionSummary;
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        opacity: 0,
        y: 20,
        delay: index * 0.08,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <article
      ref={ref}
      className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-colors hover:border-brand/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-[32px]">
          {OCCASION_EMOJIS[occasion.occasion_type]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{occasion.title}</p>
          <p className="mt-1 text-xs text-muted">
            {OCCASION_LABELS[occasion.occasion_type]} ·{" "}
            {formatOccasionDate(occasion.occasion_date)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {occasion.item_count} {occasion.item_count === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DaysPill occasion={occasion} />
          <Link
            href={`/occasions/${occasion.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-3")}
          >
            <Eye className="h-4 w-4" />
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
