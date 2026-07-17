"use client";

import { useRef } from "react";
import gsap from "gsap";
import {
  OCCASION_EMOJIS,
  OCCASION_LABELS,
  OCCASION_TYPES,
} from "@/lib/occasion/constants";
import type { OccasionType } from "@/lib/occasion/types";
import { cn } from "@/lib/utils";

export function OccasionTypeSelector({
  value,
  onChange,
}: {
  value?: OccasionType;
  onChange: (value: OccasionType) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectType = (type: OccasionType) => {
    const node = refs.current[type];
    onChange(type);

    if (node) {
      gsap.fromTo(
        node,
        { scale: 1 },
        {
          scale: 0.96,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        }
      );
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {OCCASION_TYPES.map((type) => {
        const selected = value === type;

        return (
          <button
            key={type}
            ref={(node) => {
              refs.current[type] = node;
            }}
            type="button"
            aria-pressed={selected}
            onClick={() => selectType(type)}
            className={cn(
              "flex min-h-[140px] flex-col items-center justify-center rounded-2xl border bg-white p-4 text-center transition-colors",
              selected
                ? "border-brand bg-brand-light"
                : "border-stone-100 hover:border-brand/40 hover:bg-brand-light/40"
            )}
          >
            <span className="text-[36px]" aria-hidden="true">
              {OCCASION_EMOJIS[type]}
            </span>
            <span className="mt-3 text-sm font-semibold text-ink">
              {OCCASION_LABELS[type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
