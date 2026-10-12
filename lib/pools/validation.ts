import { z } from "zod";

export const createPoolSchema = z.object({
  wishlist_id: z.string().uuid(),
  wishlist_item_id: z.string().uuid().optional(),
  receiver_id: z.string().uuid(),
  title: z.string().trim().min(3).max(100).optional(),
  target_amount: z.number().int().min(1500),
  min_contribution: z.number().int().min(1500).max(5000).default(1500),
  message: z.string().max(300).optional(),
  contributors_visible: z.boolean().default(true),
});

export const contributeSchema = z.object({
  amount: z.number().int().positive(),
});

export function createPoolContributionFormSchema(
  minimumContribution: number,
  remainingAmount: number,
  resumableAmount?: number,
) {
  return contributeSchema.superRefine(({ amount }, context) => {
    // An existing idempotent attempt must remain resumable even if the pool's
    // remaining balance has since fallen below its minimum contribution.
    if (amount === resumableAmount) return;

    if (Math.min(amount, remainingAmount) < minimumContribution) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "The amount must meet this pool's minimum contribution.",
      });
    }
  });
}

export const updatePoolTitleSchema = z.object({
  title: z.string().trim().min(3).max(100),
});

export const poolTokenSchema = z.string().uuid();

export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type CreatePoolFormValues = z.input<typeof createPoolSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
export type UpdatePoolTitleInput = z.infer<typeof updatePoolTitleSchema>;
