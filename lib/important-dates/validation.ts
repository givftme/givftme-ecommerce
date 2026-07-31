import { z } from "zod";
import { occasionDateSchema, occasionTypeSchema } from "@/lib/occasion/validation";

const linkedWishlistUrlSchema = z.string().trim().url("Enter a valid link").or(z.literal(""));

export const importantDateSchema = z.object({
  person_name: z.string().trim().min(1, "Enter a name").max(100),
  occasion_type: occasionTypeSchema,
  date: occasionDateSchema,
  is_recurring: z.boolean().default(true),
  linked_wishlist_url: linkedWishlistUrlSchema.optional(),
});

export const updateImportantDateSchema = z
  .object({
    person_name: z.string().trim().min(1, "Enter a name").max(100).optional(),
    occasion_type: occasionTypeSchema.optional(),
    date: occasionDateSchema.optional(),
    is_recurring: z.boolean().optional(),
    linked_wishlist_url: linkedWishlistUrlSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided.",
  });

export type ImportantDateFormValues = z.input<typeof importantDateSchema>;
export type ImportantDateInput = z.output<typeof importantDateSchema>;
export type UpdateImportantDateInput = z.output<typeof updateImportantDateSchema>;
