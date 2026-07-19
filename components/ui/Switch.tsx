"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "inline-flex h-7 w-12 items-center rounded-full border border-transparent p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-stone-200",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
