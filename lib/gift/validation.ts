import { z } from "zod";

/**
 * The signed out entry point's input.
 *
 * Note what is absent: no wishlist id, no product id, no price. The
 * wishlist and the catalogue product are derived server side from the
 * item, so a visitor cannot record an intent that claims one item belongs
 * to another list or another product. The client supplies the item it
 * clicked and the variant it picked, and nothing else.
 */
export const purchaseIntentSchema = z.object({
  wishlist_item_id: z.string().uuid(),
  combination_key: z.string().trim().min(1).nullable().default(null),
  // Labels only, kept so the variant picker can be restored after signup.
  // Never read as a pricing or availability fact.
  selected_options: z
    .record(z.string(), z.string())
    .nullable()
    .default(null),
  intended_action: z.enum(["reserve", "buy"]),
});

export const giftCheckoutFieldsSchema = z.object({
  gift_message: z
    .string()
    .trim()
    .max(500, "Keep your note under 500 characters")
    .optional(),
});

export type PurchaseIntentInput = z.output<typeof purchaseIntentSchema>;
