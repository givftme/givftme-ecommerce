"use client";

import { Banknote, CreditCard, Smartphone } from "lucide-react";
import type { PaymentPreference } from "@/lib/checkout/validation";
import { cn } from "@/lib/utils";

const paymentMethods = [
  {
    value: "banktransfer",
    label: "Direct Bank Transfer",
    Icon: Banknote,
  },
  {
    value: "card",
    label: "Card Payment",
    Icon: CreditCard,
  },
  {
    value: "ussd",
    label: "USSD",
    Icon: Smartphone,
  },
] as const;

interface PaymentMethodSelectorProps {
  value: PaymentPreference;
  onChange: (value: PaymentPreference) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  value,
  onChange,
  disabled,
}: PaymentMethodSelectorProps) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">Payment</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        All options are processed securely through Flutterwave.
      </p>
      <div className="mt-4 grid gap-3">
        {paymentMethods.map(({ value: methodValue, label, Icon }) => {
          const selected = value === methodValue;

          return (
            <label
              key={methodValue}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors",
                selected
                  ? "border-brand bg-brand-light"
                  : "border-stone-100 bg-white hover:bg-brand-light"
              )}
            >
              <input
                type="radio"
                name="preferred_payment"
                value={methodValue}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(methodValue)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  selected ? "bg-white text-brand" : "bg-surface text-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink">{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
