"use client";

import type { CheckoutShippingValues } from "@/lib/checkout/validation";

export interface SavedAddress extends CheckoutShippingValues {
  id: string;
  label: string;
  is_default?: boolean;
}

interface AddressSelectorProps {
  addresses: SavedAddress[];
  onSelect: (address: SavedAddress) => void;
  disabled?: boolean;
}

export function AddressSelector({
  addresses,
  onSelect,
  disabled,
}: AddressSelectorProps) {
  if (addresses.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <label className="block space-y-2">
        <span className="text-xs font-medium text-ink">Use a saved address</span>
        <select
          disabled={disabled}
          defaultValue=""
          onChange={(event) => {
            const address = addresses.find(
              (item) => item.id === event.currentTarget.value
            );

            if (address) {
              onSelect(address);
            }
          }}
          className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70"
        >
          <option value="" disabled>
            Use a saved address
          </option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.label}
              {address.is_default ? " - default" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-3 text-sm font-medium text-brand hover:underline"
        onClick={() => {
          const form = document.getElementById("checkout-shipping-form");
          form?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        Or enter a new address
      </button>
    </div>
  );
}
