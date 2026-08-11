import { z } from "zod";

export const REVIEW_BODY_MAX_LENGTH = 1000;

export const reviewSchema = z.object({
  catalog_product_id: z.string().min(1),
  rating: z.number().int().min(1, "Please select a rating.").max(5),
  body: z
    .string()
    .max(REVIEW_BODY_MAX_LENGTH, "Review must be under 1000 characters.")
    .optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1, "Please select a rating.").max(5).optional(),
    body: z
      .string()
      .max(REVIEW_BODY_MAX_LENGTH, "Review must be under 1000 characters.")
      .optional(),
  })
  .refine((value) => value.rating !== undefined || value.body !== undefined, {
    message: "No changes provided.",
  });

// The submission form always knows catalog_product_id from the page's own
// product_id search param rather than a hidden field, so the form's own
// input schema only covers what the user actually fills in.
export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "Please select a rating.").max(5),
  body: z
    .string()
    .max(REVIEW_BODY_MAX_LENGTH, "Review must be under 1000 characters.")
    .optional(),
});

export type ReviewInput = z.output<typeof reviewSchema>;
export type UpdateReviewInput = z.output<typeof updateReviewSchema>;
export type ReviewFormValues = z.input<typeof reviewFormSchema>;
