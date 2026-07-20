"use client";

export type SortValue = "default" | "price-asc" | "price-desc" | "newest";

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Sort by</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortValue)}
        className="h-10 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <option value="default">Default</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="newest">Newest</option>
      </select>
    </label>
  );
}
