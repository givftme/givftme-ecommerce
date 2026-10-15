import { z } from "zod";
import { VALID_TRANSITIONS } from "@/lib/orders/statusTransitions";
import type { OrderStatus } from "@/lib/orders/types";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);

// Payment states belong to the signature-verified Flutterwave webhook alone:
// a person marking an order `confirmed` would be recording money that was
// never captured.
export const WEBHOOK_ONLY_STATUSES: readonly OrderStatus[] = ["pending_payment", "payment_failed", "confirmed"];

/** The statuses ops may move an order to from `current`. */
export function adminNextStatuses(current: OrderStatus): OrderStatus[] {
  return (VALID_TRANSITIONS[current] ?? []).filter((status) => !WEBHOOK_ONLY_STATUSES.includes(status));
}

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["under_review", "forwarded", "shipped", "delivered", "cancelled", "refunded"]),
  tracking_number: optionalText(100),
  carrier_name: optionalText(100),
  tracking_url: z.string().trim().max(500).url("Enter a full tracking link, starting with https://.")
    .refine((value) => /^https?:\/\//i.test(value), "Enter a full tracking link, starting with https://.")
    .optional().nullable().or(z.literal("")).transform((value) => value || null),
  notes: optionalText(1000),
});
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;

export const payoutUpdateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("processing") }),
  z.object({
    status: z.literal("completed"),
    bank_name: z.string().trim().min(2, "Add the bank name.").max(100),
    account_number: z.string().trim().regex(/^\d{10}$/, "Account numbers are 10 digits (NUBAN)."),
    account_name: z.string().trim().min(2, "Add the account name.").max(150),
    reference: z.string().trim().min(3, "Add the transfer reference.").max(100),
  }),
]);
export type PayoutUpdate = z.infer<typeof payoutUpdateSchema>;

export const ENQUIRY_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const enquiryUpdateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "Nothing to update.");
export type EnquiryUpdate = z.infer<typeof enquiryUpdateSchema>;

export const personDeletionSchema = z.object({
  confirmation: z.literal("DELETE", { error: "Type DELETE to confirm." }),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500),
});
