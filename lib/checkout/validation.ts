import { z } from "zod";

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT - Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const paymentPreferenceSchema = z.enum([
  "card",
  "banktransfer",
  "ussd",
]);

const nigerianStateSchema = z.string().refine(
  (value): value is NigerianState =>
    NIGERIAN_STATES.includes(value as NigerianState),
  { message: "Select a state" }
);

const optionalTrimmedString = (maxLength?: number) => {
  let schema = z.string().trim();

  if (maxLength) {
    schema = schema.max(maxLength);
  }

  return z
    .union([schema, z.literal(""), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    });
};

export const checkoutShippingSchema = z.object({
  first_name: z.string().trim().min(1, "First name required"),
  last_name: z.string().trim().min(1, "Last name required"),
  email: z.string().trim().email("Enter a valid email").toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
  street_address: z.string().trim().min(5, "Enter your full street address"),
  apartment: optionalTrimmedString(120),
  city: z.string().trim().min(2, "City required"),
  state: nigerianStateSchema,
  postal_code: optionalTrimmedString(20),
  delivery_instructions: optionalTrimmedString(500),
});

export const checkoutCartItemSchema = z.object({
  catalog_product_id: z.string().trim().min(1),
  combination_key: z.string().trim().min(1).nullable(),
  quantity: z.number().int().min(1).max(99),
  // Client-submitted price is display-only. API routes must refetch prices.
  display_price: z.number().positive(),
});

export const checkoutSchema = z.object({
  cart_items: z.array(checkoutCartItemSchema).min(1, "Cart is empty"),
  shipping: checkoutShippingSchema,
  preferred_payment: paymentPreferenceSchema.optional(),
  wishlist_item_id: z.string().uuid().optional(),
});

export const checkoutFormSchema = z.object({
  shipping: checkoutShippingSchema,
  preferred_payment: paymentPreferenceSchema.default("card"),
});

export type CheckoutInput = z.output<typeof checkoutSchema>;
export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormValues = z.output<typeof checkoutFormSchema>;
export type CheckoutShippingValues = z.output<typeof checkoutShippingSchema>;
export type PaymentPreference = z.output<typeof paymentPreferenceSchema>;
