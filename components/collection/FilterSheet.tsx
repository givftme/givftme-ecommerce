"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

export interface ProductFilters {
  minPrice: string;
  maxPrice: string;
  occasionTypes: string[];
}

interface FilterControlsProps {
  filters: ProductFilters;
  occasionTypes: string[];
  onChange: (filters: ProductFilters) => void;
  onApply?: () => void;
  onClear: () => void;
  className?: string;
}

function FilterControls({
  filters,
  occasionTypes,
  onChange,
  onApply,
  onClear,
  className,
}: FilterControlsProps) {
  const toggleOccasion = (occasion: string) => {
    const selected = filters.occasionTypes.includes(occasion)
      ? filters.occasionTypes.filter((item) => item !== occasion)
      : [...filters.occasionTypes, occasion];

    onChange({ ...filters, occasionTypes: selected });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink">Price range</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="space-y-2">
            <span className="text-xs font-medium text-muted">Min</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.minPrice}
              onChange={(event) =>
                onChange({ ...filters, minPrice: event.target.value })
              }
              placeholder="0"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-muted">Max</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.maxPrice}
              onChange={(event) =>
                onChange({ ...filters, maxPrice: event.target.value })
              }
              placeholder="50000"
            />
          </label>
        </div>
      </div>

      {occasionTypes.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Occasion type</h3>
          <div className="mt-3 space-y-2">
            {occasionTypes.map((occasion) => (
              <label
                key={occasion}
                className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={filters.occasionTypes.includes(occasion)}
                  onChange={() => toggleOccasion(occasion)}
                  className="h-4 w-4 accent-brand"
                />
                <span className="capitalize">{occasion.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {onApply ? (
          <Button type="button" fullWidth onClick={onApply}>
            Apply filters
          </Button>
        ) : null}
        <Button type="button" variant="text" fullWidth onClick={onClear}>
          Clear all
        </Button>
      </div>
    </div>
  );
}

export function FilterSidebar(props: FilterControlsProps) {
  return (
    <aside className="hidden w-60 shrink-0 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm lg:block">
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <SlidersHorizontal className="h-4 w-4" />
        Filter
      </div>
      <FilterControls {...props} />
    </aside>
  );
}

export function FilterSheet({
  open,
  onOpenChange,
  ...props
}: FilterControlsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter gifts</SheetTitle>
          <SheetDescription>
            Narrow the currently loaded catalog products.
          </SheetDescription>
        </SheetHeader>
        <FilterControls
          {...props}
          className="mt-6"
          onApply={() => {
            props.onApply?.();
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
