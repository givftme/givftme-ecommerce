import { z } from "zod";
import { OCCASION_TYPES } from "@/lib/occasion/constants";
import { isMoreThanFiveYearsAway } from "@/lib/occasion/date";
import { externalWishlistItemSchema } from "@/lib/wishlist/validation";

export const occasionTypeSchema = z.enum(OCCASION_TYPES);

export const occasionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date")
  .refine((value) => !isMoreThanFiveYearsAway(value), {
    message: "Date can't be more than 5 years in the future",
  });

export const occasionBasicsSchema = z.object({
  title: z.string().trim().min(1, "Give your occasion a name").max(100),
  occasion_type: occasionTypeSchema,
  occasion_date: occasionDateSchema,
});

export const createOccasionSchema = occasionBasicsSchema.extend({
  pulled_item_ids: z.array(z.string().uuid()).default([]),
  exclusive_items: z.array(externalWishlistItemSchema).default([]),
});

export const updateOccasionSchema = z
  .object({
    title: z.string().trim().min(1, "Give your occasion a name").max(100).optional(),
    occasion_type: occasionTypeSchema.optional(),
    occasion_date: occasionDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided.",
  });

export const reactivateItemsSchema = z.object({
  item_ids: z.array(z.string().uuid()).default([]),
});

export const addPulledOccasionItemsSchema = z.object({
  pulled_item_ids: z.array(z.string().uuid()).min(1),
});

export type OccasionBasicsInput = z.input<typeof occasionBasicsSchema>;
export type OccasionBasics = z.output<typeof occasionBasicsSchema>;
export type CreateOccasionInput = z.output<typeof createOccasionSchema>;
export type UpdateOccasionInput = z.output<typeof updateOccasionSchema>;
