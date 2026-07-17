"use client";

/* eslint-disable @next/next/no-img-element */

import { Gift } from "lucide-react";
import type { ReactNode } from "react";
import type { MasterItem } from "@/lib/occasion/types";
import { formatWishlistPrice } from "@/lib/wishlist/display";
import { cn } from "@/lib/utils";

function MasterItemThumb({ item }: { item: MasterItem }) {
  if (!item.image_url) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
        <Gift className="h-5 w-5 text-stone-300" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-xl object-cover"
    />
  );
}

export function PullFromEvergreen({
  items,
  selectedIds,
  onSelectedIdsChange,
  emptyAction,
}: {
  items: MasterItem[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  emptyAction?: ReactNode;
}) {
  const selected = new Set(selectedIds);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onSelectedIdsChange(selectedIds.filter((itemId) => itemId !== id));
      return;
    }

    onSelectedIdsChange([...selectedIds, id]);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white px-4 py-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <Gift className="h-8 w-8 text-stone-300" strokeWidth={1.5} />
        </div>
        <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-muted">
          Your main wishlist is empty - you can still add items in the next step.
        </p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end gap-4">
        <button
          type="button"
          onClick={() => onSelectedIdsChange(items.map((item) => item.id))}
          className="text-sm font-medium text-brand hover:text-brand-dark"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => onSelectedIdsChange([])}
          className="text-sm font-medium text-muted hover:text-ink"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const checked = selected.has(item.id);

          return (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition-colors",
                checked ? "border-brand bg-brand-light" : "border-stone-100"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(item.id)}
                className="h-5 w-5 rounded border-stone-300 accent-brand"
              />
              <MasterItemThumb item={item} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {item.title}
                </span>
                {item.price != null && (
                  <span className="mt-1 block text-xs font-semibold text-ink">
                    {formatWishlistPrice(item.price)}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
