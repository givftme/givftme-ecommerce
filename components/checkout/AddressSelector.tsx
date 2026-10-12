"use client";

import { useState } from "react";
import type { CheckoutShippingValues } from "@/lib/checkout/validation";

export interface SavedAddress extends CheckoutShippingValues {
  id: string;
  label: string;
  is_default?: boolean;
}

interface AddressSelectorProps {
  addresses: SavedAddress[];
  onSelect: (address: SavedAddress) => void;
  onEnterNewAddress: () => void;
  defaultAddressId?: string;
  disabled?: boolean;
}

export function AddressSelector({
  addresses,
  onSelect,
  onEnterNewAddress,
  defaultAddressId,
  disabled,
}: AddressSelectorProps) {
  const enterNewAddressValue = "__enter_new_address__";
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddressId || "");

  if (addresses.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <label className="block space-y-2">
        <span className="text-xs font-medium text-ink">Use a saved address</span>
        <select
          disabled={disabled}
          value={selectedAddressId}
          onChange={(event) => {
            const selectedId = event.currentTarget.value;
            if (selectedId === enterNewAddressValue) {
              setSelectedAddressId("");
              onEnterNewAddress();
              return;
            }

            const address = addresses.find((item) => item.id === selectedId);

            if (address) {
              setSelectedAddressId(address.id);
              onSelect(address);
            }
          }}
          className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70"
        >
          <option value="" disabled>
            Choose a saved address
          </option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.label || `${address.first_name} ${address.last_name}`} — {address.street_address}, {address.city}
            </option>
          ))}
          <option value={enterNewAddressValue}>Enter a new address ↓</option>
        </select>
      </label>
    </div>
  );
}
