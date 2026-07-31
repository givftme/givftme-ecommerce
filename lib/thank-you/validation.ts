import { z } from "zod";

export const personalThankYouSchema = z.object({
  source: z.enum(["purchase", "order"]),
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(1000, "Message must be under 1000 characters"),
});

export type PersonalThankYouInput = z.output<typeof personalThankYouSchema>;
