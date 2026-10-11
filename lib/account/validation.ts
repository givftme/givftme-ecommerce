import { z } from "zod";

import { NIGERIAN_STATES, type NigerianState } from "@/lib/checkout/validation";

export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export const DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER =
  "Thank you so much for the gift, I really appreciate you!";

export const DELETE_CONFIRMATION_TEXT = "DELETE";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number")
    .optional()
    .or(z.literal("")),
  default_thank_you_msg: z.string().max(300, "Keep it under 300 characters").optional().or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

const nigerianStateSchema = z.string().refine(
  (value): value is NigerianState => NIGERIAN_STATES.includes(value as NigerianState),
  { message: "Select a state" },
);

export const addressSchema = z.object({
  label: z.string().trim().max(50).transform((value) => value || "Home").default("Home"),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number")
    .optional()
    .or(z.literal("")),
  street_address: z.string().trim().min(5, "Enter your full street address"),
  apt_suite_unit: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required"),
  state: nigerianStateSchema,
  postal_code: z.string().trim().optional().or(z.literal("")),
  delivery_instructions: z.string().trim().max(500, "Keep this under 500 characters").optional().or(z.literal("")),
  is_default: z.boolean().default(false),
  is_default_billing: z.boolean().default(false),
});

export const addressPatchSchema = addressSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one address field to update" },
);

export type AddressFormInput = z.input<typeof addressSchema>;
export type AddressValues = z.output<typeof addressSchema>;
export type AddressPatchValues = z.output<typeof addressPatchSchema>;

export function isValidDeleteConfirmation(value: string) {
  return value === DELETE_CONFIRMATION_TEXT;
}
