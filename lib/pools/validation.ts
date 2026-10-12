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

export const updatePoolTitleSchema = z.object({
  title: z.string().trim().min(3).max(100),
});

export const poolTokenSchema = z.string().uuid();

export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
export type UpdatePoolTitleInput = z.infer<typeof updatePoolTitleSchema>;
