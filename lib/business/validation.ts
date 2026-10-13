import { z } from "zod";

export const BUSINESS_TEAM_SIZES = ["1–20", "21–100", "101–500", "500+"] as const;
export type BusinessTeamSize = (typeof BUSINESS_TEAM_SIZES)[number];

export const BUSINESS_OCCASIONS = [
  "Team birthdays",
  "Customer Service Week",
  "Father’s / Mother’s Day",
  "Executives",
  "Business partners",
  "Team hangout",
  "End of year",
  "Gift cards",
] as const;
export type BusinessOccasion = (typeof BUSINESS_OCCASIONS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The Experience Centre brief. An email or a phone number is enough to reach the sender. */
export const businessEnquirySchema = z
  .object({
    company: z.string().trim().min(1, "Add your company name.").max(120),
    name: z.string().trim().min(1, "Add your name.").max(120),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((value) => !value || EMAIL_PATTERN.test(value), "That email doesn’t look right."),
    phone: z.string().trim().max(30),
    occasions: z.array(z.enum(BUSINESS_OCCASIONS)),
    teamSize: z.enum(BUSINESS_TEAM_SIZES),
    neededBy: z.string(),
    notes: z.string().trim().max(1000, "Keep this under 1,000 characters."),
  })
  .refine((value) => value.email || value.phone, {
    message: "Add an email or phone number so we can reach you.",
    path: ["email"],
  });

export type BusinessEnquiryValues = z.infer<typeof businessEnquirySchema>;

/** Buckets a head count into the form's team size options. */
export function teamSizeFor(count: number): BusinessTeamSize {
  if (count <= 20) return "1–20";
  if (count <= 100) return "21–100";
  if (count <= 500) return "101–500";
  return "500+";
}
