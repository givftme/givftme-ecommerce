import type { AddressValues } from "@/lib/account/validation";

export interface SavedAddressRecord extends Omit<AddressValues, "phone" | "apt_suite_unit" | "postal_code" | "delivery_instructions"> {
  id: string;
  user_id: string;
  phone: string | null;
  apt_suite_unit: string | null;
  postal_code: string | null;
  delivery_instructions: string | null;
  created_at: string;
  updated_at: string;
}
