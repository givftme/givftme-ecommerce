import { readJson } from "@/lib/api/response";
import { authorizePricingAdmin, pricingFailure, pricingJson } from "@/lib/pricing/http";
import { PricingError } from "@/lib/pricing/preview";
import { publishRate } from "@/lib/pricing/server";
import { publishSchema } from "@/lib/pricing/validation";

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const user = await authorizePricingAdmin(request);
    const body = await readJson(request);
    if (body === null) throw new PricingError("invalid_json", 400);
    const parsed = publishSchema.safeParse(body);
    const { key } = await context.params;
    if (!parsed.success || parsed.data.proposal.policy_key !== key) throw new PricingError("invalid_proposal", 422);
    return pricingJson(await publishRate(user.id, request.headers.get("idempotency-key")!, parsed.data.proposal, parsed.data.preview_token));
  } catch (error) { return pricingFailure(error); }
}
