import { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-brand-light text-brand",
        success: "bg-success/10 text-success",
        danger: "bg-brand-light text-danger",
        warning: "bg-warning/10 text-warning",
        info: "bg-blue/10 text-blue",
        muted: "bg-surface text-muted",
        sale: "bg-primary text-primary-foreground",
        purple: "bg-purple-light text-purple dark:bg-purple/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
