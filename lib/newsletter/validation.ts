import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
