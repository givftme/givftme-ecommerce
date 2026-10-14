import { cn } from "@/lib/utils";

// Lightweight, dependency-free admin charts. Every mark carries a native
// tooltip (title) and the values it encodes are printed as text, so nothing
// is read from color alone. Categorical slots come from the validated
// --viz-* tokens in app/globals.css, always in the same order.

export const VIZ_SLOTS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"] as const;

/** A fixed slot per key, so an entity keeps its color whatever else is shown. */
export function slotColor(keys: readonly string[], key: string) {
  const index = keys.indexOf(key);
  return index >= 0 && index < VIZ_SLOTS.length ? VIZ_SLOTS[index]! : "var(--color-muted)";
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 112;
  const height = 32;
  if (values.length < 2) return <div className="h-8" aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - 3 - (value / max) * (height - 6)] as const);
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-28 overflow-visible" role="img" aria-label={`${label}, last 7 days: ${values.join(", ")}`}>
      <path d={path} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={6} fill="transparent">
          <title>{`${values.length - 1 - index === 0 ? "Today" : `${values.length - 1 - index}d ago`}: ${values[index]!.toLocaleString("en-NG")}`}</title>
        </circle>
      ))}
      <circle cx={lastX} cy={lastY} r={3} fill="var(--viz-1)" stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}

export interface BarListItem {
  label: string;
  value: number;
  display?: string;
  sublabel?: string;
}

/** Ranked horizontal bars: magnitude by length, one hue. */
export function BarList({ items, empty = "Nothing yet." }: { items: BarListItem[]; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${item.display ?? item.value.toLocaleString("en-NG")}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink">{item.display ?? item.value.toLocaleString("en-NG")}</span>
          </div>
          {item.sublabel ? <p className="truncate text-xs text-muted">{item.sublabel}</p> : null}
          <div className="mt-1 h-2 w-full rounded-full bg-surface">
            <div className="h-2 rounded-full" style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%`, background: "var(--viz-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface ColumnSeries {
  key: string;
  label: string;
}

export interface ColumnDatum {
  label: string;
  values: Record<string, number>;
}

/**
 * Vertical columns, stacked when there is more than one series. Each stack
 * shows its total above it; the legend names every series.
 */
export function ColumnChart({
  data,
  series,
  height = 160,
  format = (n) => n.toLocaleString("en-NG"),
  empty = "Nothing yet.",
}: {
  data: ColumnDatum[];
  series: ColumnSeries[];
  height?: number;
  format?: (n: number) => string;
  empty?: string;
}) {
  const totals = data.map((datum) => series.reduce((sum, s) => sum + (datum.values[s.key] ?? 0), 0));
  if (!data.length || totals.every((total) => total === 0)) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }
  const max = Math.max(...totals, 1);
  const keys = series.map((s) => s.key);
  return (
    <div>
      {series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: slotColor(keys, s.key) }))} /> : null}
      <div className="mt-3 flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: height + 40 }}>
        {data.map((datum, index) => {
          const total = totals[index]!;
          return (
            <div key={datum.label} className="flex min-w-7 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] tabular-nums text-muted">{total ? format(total) : ""}</span>
              <div className="flex w-full max-w-10 flex-col-reverse gap-[2px]" style={{ height: (total / max) * height }}>
                {series.map((s) => {
                  const value = datum.values[s.key] ?? 0;
                  if (!value) return null;
                  return (
                    <div
                      key={s.key}
                      className="w-full first:rounded-b-[4px] last:rounded-t-[4px]"
                      style={{ flexGrow: value, background: series.length > 1 ? slotColor(keys, s.key) : "var(--viz-1)" }}
                      title={`${datum.label} · ${s.label}: ${format(value)}`}
                    />
                  );
                })}
              </div>
              <span className="max-w-full truncate text-[11px] text-muted">{datum.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
          {item.value ? <span className="tabular-nums text-muted">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** A part-to-whole ring with a labelled legend carrying every count. */
export function Donut({
  items,
  keys,
  empty = "Nothing yet.",
}: {
  items: { key: string; label: string; value: number }[];
  /** The fixed key order that assigns colors. */
  keys: readonly string[];
  empty?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = items.filter((item) => item.value > 0).length > 1 ? 2 : 0;
  const lengths = items.map((item) => (item.value / total) * circumference);
  const offsets = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0));
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={items.map((item) => `${item.label} ${item.value}`).join(", ")}>
        {items.map((item, index) => (
            <circle
              key={item.key}
              cx={60}
              cy={60}
              r={radius}
              fill="none"
              stroke={slotColor(keys, item.key)}
              strokeWidth={16}
              strokeDasharray={`${Math.max(lengths[index]! - gap, 0)} ${circumference}`}
              strokeDashoffset={-offsets[index]!}
            >
              <title>{`${item.label}: ${item.value.toLocaleString("en-NG")} (${Math.round((item.value / total) * 100)}%)`}</title>
            </circle>
        ))}
      </svg>
      <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-ink">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: slotColor(keys, item.key) }} />
              {item.label}
            </span>
            <span className="tabular-nums text-muted">
              {item.value.toLocaleString("en-NG")} · {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Funnel steps as bars against the first step, drop-off as red text. */
export function Funnel({ steps }: { steps: { label: string; users: number; dropOff: number | null }[] }) {
  const top = Math.max(steps[0]?.users ?? 0, 1);
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.label} title={`${step.label}: ${step.users.toLocaleString("en-NG")}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{step.label}</span>
            <span className="flex items-baseline gap-3">
              {step.dropOff != null && step.dropOff > 0 ? (
                <span className="text-xs font-medium text-danger">−{step.dropOff.toFixed(1)}%</span>
              ) : null}
              <span className="w-16 text-right font-semibold tabular-nums text-ink">{step.users.toLocaleString("en-NG")}</span>
            </span>
          </div>
          <div className="mt-1 h-3 w-full rounded-full bg-surface">
            <div className="h-3 rounded-full" style={{ width: `${Math.max((step.users / top) * 100, step.users > 0 ? 1.5 : 0)}%`, background: "var(--viz-1)" }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Sequential single-hue fill for a 0–100 value; null renders empty. */
export function heatStyle(percent: number | null) {
  if (percent == null) return undefined;
  const strength = Math.round(8 + Math.min(Math.max(percent, 0), 100) * 0.5);
  return { background: `color-mix(in oklab, var(--viz-heat) ${strength}%, transparent)` };
}

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-surface", className)} role="presentation">
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: "var(--viz-1)" }} />
    </div>
  );
}
