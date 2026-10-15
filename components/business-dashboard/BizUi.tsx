"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode, type SelectHTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Award,
  Baby,
  Cake,
  Flag,
  Flower2,
  Gift,
  Headset,
  Leaf,
  Moon,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { OCCASIONS, type CampaignStatus, type GiftTier, type OccasionIconName } from "@/lib/business-dashboard/data";
import type { UpcomingMoment } from "@/lib/business-dashboard/types";
import { colorPalette, formatDaysAway, formatShortDate, initials } from "@/lib/business-dashboard/utils";
import { cn } from "@/lib/utils";

// Shared presentational pieces for the business dashboard views.

/** Spec card style: rounded-2xl, line border, card background. */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-card", className)}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ViewHeader({
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

export function StatCard({
  label,
  value,
  hint,
  pill,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  pill?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {pill}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink md:text-[28px]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 min-[1001px]:grid-cols-4 md:gap-4">{children}</div>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const [background, color] = colorPalette(name);
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: background, color }}
      className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold", className)}
    >
      {initials(name)}
    </span>
  );
}

const STATUS_VARIANT: Record<CampaignStatus, BadgeProps["variant"]> = {
  Draft: "muted",
  "Pending approval": "warning",
  Approved: "info",
  Delivered: "success",
};

export function StatusPill({ status }: { status: CampaignStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

const TIER_VARIANT: Record<GiftTier, BadgeProps["variant"]> = {
  Standard: "muted",
  Premium: "purple",
  Signature: "default",
};

export function TierPill({ tier }: { tier: GiftTier }) {
  return <Badge variant={TIER_VARIANT[tier]}>{tier}</Badge>;
}

/** "in X days" — amber when a week or less away. */
export function DaysChip({ days }: { days: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
        days <= 7 ? "bg-amber-50 text-amber-700 dark:bg-amber/15 dark:text-amber" : "bg-surface text-muted",
      )}
    >
      {formatDaysAway(days)}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children ? <p className="max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Native select styled like the project's rounded-xl inputs. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export function Checkbox({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input type="checkbox" className={cn("h-4 w-4 shrink-0 rounded accent-brand", className)} {...props} />;
}

const OCCASION_ICONS: Record<OccasionIconName, LucideIcon> = {
  cake: Cake,
  award: Award,
  headset: Headset,
  "flower-2": Flower2,
  "user-round": UserRound,
  moon: Moon,
  flag: Flag,
  gift: Gift,
  baby: Baby,
  // lucide has no "spa" icon; a leaf keeps sympathy quiet.
  spa: Leaf,
};

export function occasionFor(key: string) {
  return OCCASIONS.find((occasion) => occasion.key === key) ?? null;
}

/** An occasion's icon on a tint of its colour. Unknown occasions get a gift. */
export function OccasionIcon({ occasion, size = "md" }: { occasion: string; size?: "sm" | "md" }) {
  const match = occasionFor(occasion);
  const Icon = match ? OCCASION_ICONS[match.icon] : Gift;
  const color = match?.color ?? "#C40404";
  return (
    <span
      aria-hidden="true"
      style={{ color, backgroundColor: `${color}1A` }}
      className={cn("grid shrink-0 place-items-center rounded-xl", size === "sm" ? "h-8 w-8" : "h-10 w-10")}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

/** One upcoming moment: avatar, name, type, sub-label, countdown and date. */
export function MomentRow({ moment }: { moment: UpcomingMoment }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {moment.occasion ? <OccasionIcon occasion={moment.occasion} size="sm" /> : <Avatar name={moment.who} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {moment.who}
          <span
            className={cn(
              "ml-2 text-xs font-medium",
              moment.type === "anniversary" ? "text-purple" : moment.type === "campaign" ? "text-green" : "text-brand",
            )}
          >
            {moment.label}
          </span>
        </p>
        {moment.sub ? <p className="truncate text-xs text-muted">{moment.sub}</p> : null}
      </div>
      <DaysChip days={moment.days} />
      <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted sm:block">
        {formatShortDate(moment.date)}
      </span>
    </li>
  );
}

// --- Modal --------------------------------------------------------------------

/**
 * Radix dialog with the spec's entrance (opacity 0 + scale 0.98 → 1, 0.25s).
 * Wide by default for the wizards; one responsive surface on every screen.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40 transition-opacity duration-[250ms] starting:opacity-0 motion-reduce:duration-[0.01ms]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-ink shadow-float outline-none",
            "transition-[opacity,scale] duration-[250ms] starting:scale-[0.98] starting:opacity-0 motion-reduce:duration-[0.01ms]",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-bold text-ink">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
              <X className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 md:px-6">
              {footer}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Step dots for the 3-step wizards. */
export function Steps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full font-bold",
              index < current ? "bg-success/15 text-success" : index === current ? "bg-brand text-white" : "bg-surface text-muted",
            )}
          >
            {index + 1}
          </span>
          <span className={cn("font-medium", index === current ? "text-ink" : "text-muted")}>{step}</span>
          {index < steps.length - 1 ? <span aria-hidden="true" className="h-px w-5 bg-line" /> : null}
        </li>
      ))}
    </ol>
  );
}
