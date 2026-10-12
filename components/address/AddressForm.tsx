"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { NIGERIAN_STATES } from "@/lib/constants";

export type AddressFieldName =
  | "first_name"
  | "last_name"
  | "street_address"
  | "apartment"
  | "city"
  | "state"
  | "phone"
  | "postal_code"
  | "delivery_instructions";

export function AddressForm<TFieldValues extends FieldValues>({
  control,
  fieldName,
  phoneRequired = false,
  showNameFields = true,
  addressLine1Label = "Street address",
  addressLine2Label = "Apt, suite, unit",
}: {
  control: Control<TFieldValues>;
  fieldName: (field: AddressFieldName) => FieldPath<TFieldValues>;
  phoneRequired?: boolean;
  showNameFields?: boolean;
  addressLine1Label?: string;
  addressLine2Label?: string;
}) {
  return (
    <div className="space-y-4">
      {showNameFields ? (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField control={control} name={fieldName("first_name")} render={({ field }) => (
            <FormItem><FormLabel>First name</FormLabel><Input autoComplete="given-name" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
          )} />
          <FormField control={control} name={fieldName("last_name")} render={({ field }) => (
            <FormItem><FormLabel>Last name</FormLabel><Input autoComplete="family-name" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
          )} />
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-xs font-medium text-ink">Country / Region</span>
        <Input value="Nigeria" disabled readOnly />
      </label>

      <FormField control={control} name={fieldName("street_address")} render={({ field }) => (
        <FormItem><FormLabel>{addressLine1Label}</FormLabel><Input autoComplete="street-address" placeholder="House number and street name" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
      )} />

      <FormField control={control} name={fieldName("apartment")} render={({ field }) => (
        <FormItem><FormLabel>{addressLine2Label}</FormLabel><Input placeholder="Apartment, suite, unit, etc. (optional)" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
      )} />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField control={control} name={fieldName("city")} render={({ field }) => (
          <FormItem><FormLabel>City</FormLabel><Input autoComplete="address-level2" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
        )} />
        <FormField control={control} name={fieldName("state")} render={({ field }) => (
          <FormItem>
            <FormLabel>State</FormLabel>
            <select
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="" disabled>Select a state</option>
              {NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={control} name={fieldName("phone")} render={({ field }) => (
        <FormItem><FormLabel>{phoneRequired ? "Phone number" : "Phone number (optional)"}</FormLabel><Input type="tel" autoComplete="tel" placeholder="08012345678" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
      )} />

      <FormField control={control} name={fieldName("postal_code")} render={({ field }) => (
        <FormItem><FormLabel>Postal code (optional)</FormLabel><Input autoComplete="postal-code" {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
      )} />

      <FormField control={control} name={fieldName("delivery_instructions")} render={({ field }) => (
        <FormItem><FormLabel>Delivery instructions (optional)</FormLabel><Textarea placeholder="e.g. ring the bell, leave at gate" maxLength={500} {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
      )} />
    </div>
  );
}
