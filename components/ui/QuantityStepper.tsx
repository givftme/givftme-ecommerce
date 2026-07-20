"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantityStepperProps) {
  const nextValue = Math.max(min, Math.min(max, value));

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-full border border-stone-200 bg-white",
        className
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={nextValue <= min}
        onClick={() => onChange(nextValue - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-light hover:text-brand disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold text-ink">
        {nextValue}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={nextValue >= max}
        onClick={() => onChange(nextValue + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-light hover:text-brand disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
