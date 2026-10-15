import { z } from "zod";
import {
  BUSINESS_ROLES,
  CAMPAIGN_STATUSES,
  REMINDER_CHANNELS,
  RULES,
  SIGNUP_ROLES,
  TIERS,
} from "@/lib/business-dashboard/data";
import { emailSchema, passwordSchema } from "@/lib/auth/validation";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const MMDD = /^\d{2}-\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Person add/edit (spec "Validation"). Shared by PersonModal and the actions.
export const personSchema = z.object({
  name: z.string().trim().min(2).max(100),
  bday: z.string().regex(MMDD, "Must be MM-DD"),
  tier: z.enum(TIERS),
  department: optionalText(100),
  role_title: optionalText(100),
  start_date: z.string().optional(), // ISO date
  company: optionalText(120),
  relationship: optionalText(60),
  account_owner: optionalText(100),
});

export type PersonValues = z.infer<typeof personSchema>;

export const personKindSchema = z.enum(["staff", "client"]);

// Campaign (spec "Validation").
export const campaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  occasion: z.string().min(1),
  audience: z.string().min(1),
  heads: z.number().int().min(1),
  per_head: z.number().min(0),
  delivery_date: z.string().refine((d) => !isNaN(Date.parse(d))),
  gift_type: z.string().min(1),
  card_message: z.string().max(300).optional(),
});

export type CampaignValues = z.infer<typeof campaignSchema>;

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);

/** An import row after client-side validation; the server re-checks it. */
export const importPersonSchema = personSchema.extend({
  department: z.string().trim().max(100).nullable().optional(),
  role_title: z.string().trim().max(100).nullable().optional(),
  start_date: z.string().regex(ISO_DATE).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  relationship: z.string().trim().max(60).nullable().optional(),
  account_owner: z.string().trim().max(100).nullable().optional(),
});

export const MAX_IMPORT_ROWS = 5000;

export const importRequestSchema = z.object({
  kind: personKindSchema,
  people: z.array(importPersonSchema).min(1, "That file looks empty").max(MAX_IMPORT_ROWS),
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// A data URL logo is stored inline on business_accounts.logo_url.
export const MAX_LOGO_BYTES = 300 * 1024;

export const brandSchema = z.object({
  company_name: z.string().trim().min(1, "Add your company name.").max(120),
  brand_color: z.string().regex(HEX_COLOR, "Use a hex colour like #C40404."),
  logo_url: z
    .string()
    .max(Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 100)
    .refine(
      (value) => value === "" || /^data:image\/(png|svg\+xml);base64,/.test(value) || /^https:\/\//.test(value),
      "Upload a PNG or SVG logo.",
    )
    .nullable(),
  default_message: z.string().trim().min(1, "Add a default message.").max(300),
});

export type BrandValues = z.infer<typeof brandSchema>;

export const reminderSettingsSchema = z.object({
  reminder_contact: z.string().trim().max(120),
  reminder_cc_email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, "That email doesn't look right."),
  reminder_channel: z.enum(REMINDER_CHANNELS),
  auto_approve_under: z.number().min(0),
});

export type ReminderSettingsValues = z.infer<typeof reminderSettingsSchema>;

export const ruleKeySchema = z.enum(RULES.map((rule) => rule.key) as [string, ...string[]]);

export const teamMemberUpdateSchema = z.object({
  role: z.enum(BUSINESS_ROLES),
  department: z.string().trim().max(100).optional(),
});

export const budgetSchema = z.object({
  used: z.number().min(0),
  annual_budget: z.number().min(0).optional(),
});

// --- Auth -------------------------------------------------------------------

export const businessSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export type BusinessSignInValues = z.infer<typeof businessSignInSchema>;

export const businessSignUpSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(120),
  email: emailSchema,
  role: z.enum(SIGNUP_ROLES, { message: "Choose your role." }),
  password: passwordSchema,
});

export type BusinessSignUpValues = z.infer<typeof businessSignUpSchema>;

// --- Experience Centre brief ----------------------------------------------

export const businessBriefSchema = z.object({
  occasion: z.string().trim().min(1, "Choose an occasion.").max(80),
  neededBy: z.string().refine((value) => value === "" || ISO_DATE.test(value), "Pick a date."),
  heads: z.number().int().min(0).max(100000),
  phone: z.string().trim().max(30),
  notes: z.string().trim().min(1, "Tell us what you have in mind.").max(1000, "Keep this under 1,000 characters."),
});

export type BusinessBriefValues = z.infer<typeof businessBriefSchema>;
