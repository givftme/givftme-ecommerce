import { z } from "zod";
import { POLICY_KEYS } from "./types";
import { normalizeSource, parseAmount } from "./calculate";

export const policyKeySchema = z.enum(POLICY_KEYS);
const amountSchema = z.string().max(17);
export const proposalSchema = z.object({
  policy_key: policyKeySchema,
  rate_bps: z.number().int().min(0).max(50000),
  expected_revision: z.number().int().min(0).max(2147483646),
  reason: z.string().trim().min(1).max(1000),
  sample_amount_ngn: amountSchema,
  sample_delivery_ngn: amountSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.policy_key === "partial_cash_payout" && value.rate_bps > 9999) {
    ctx.addIssue({ code: "custom", message: "Partial payout rate must be below 100 percent." });
  }
  try {
    if (value.policy_key === "linked" || value.policy_key === "manual_sourced") {
      normalizeSource(value.sample_amount_ngn);
      if (value.sample_delivery_ngn !== null) parseAmount(value.sample_delivery_ngn, 0);
    } else {
      if (parseAmount(value.sample_amount_ngn, 0) <= BigInt(0)) throw new Error();
      if (value.sample_delivery_ngn !== null) throw new Error();
    }
  } catch {
    ctx.addIssue({ code: "custom", message: "Use a positive NGN amount with valid precision. Cash has no delivery." });
  }
});

export type RateProposal = z.infer<typeof proposalSchema>;
export const previewSchema = z.object({
  purpose: z.enum(["sample", "rate_publish"]),
  proposal: proposalSchema,
}).strict();
export const publishSchema = z.object({
  proposal: proposalSchema,
  preview_token: z.string().min(1).max(4096),
}).strict();
export const requestKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
