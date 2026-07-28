import { z } from "zod";

export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export const DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER =
  "Thank you so much for the gift, I really appreciate you!";

export const DELETE_CONFIRMATION_TEXT = "DELETE";

export const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  default_thank_you_msg: z.string().max(500).optional().or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function isValidDeleteConfirmation(value: string) {
  return value === DELETE_CONFIRMATION_TEXT;
}
