import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Presentational building blocks for /admin screens. Server-safe: no hooks,
// so pages render them without shipping client JavaScript.

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-card p-5 shadow-card", className)}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "alert";
}) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", tone === "alert" ? "text-danger" : "text-ink")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const className = "block min-w-0 rounded-2xl border border-line bg-card p-4 shadow-card";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** ↑/↓ change against a previous value, with an icon so it never relies on color. */
export function Delta({ value, format = (n) => n.toLocaleString("en-NG") }: { value: number; format?: (n: number) => string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted">
        <Minus aria-hidden="true" className="h-3 w-3" /> no change
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-success" : "text-danger")}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {format(Math.abs(value))}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-xs text-muted">{children}</p> : null}
    </div>
  );
}

/** Horizontal scroll on small screens; the page itself never scrolls sideways. */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-5 overflow-x-auto px-5", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted first:pl-0 last:pr-0";
export const td = "border-b border-line px-3 py-3 align-top text-ink first:pl-0 last:pr-0";
export const tdNum = cn(td, "text-right tabular-nums");
export const thNum = cn(th, "text-right");

export function TabLinks<T extends string>({
  options,
  active,
  hrefFor,
  label,
}: {
  options: readonly { value: T; label: string }[];
  active: T;
  hrefFor: (value: T) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-card p-1">
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              selected ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RoleBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">{children}</span>;
}

export const fieldLabel = "mb-1 block text-xs font-medium text-muted";
export const selectClass =
  "h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
export const smallInput =
  "h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";
