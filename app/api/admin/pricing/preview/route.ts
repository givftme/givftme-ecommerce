import { readJson } from "@/lib/api/response";
import { authorizePricingAdmin, pricingFailure, pricingJson } from "@/lib/pricing/http";
import { PricingError } from "@/lib/pricing/preview";
import { previewRate } from "@/lib/pricing/server";
import { previewSchema } from "@/lib/pricing/validation";

export async function POST(request: Request) {
  try {
    const user = await authorizePricingAdmin(request);
    const body = await readJson(request);
    if (body === null) throw new PricingError("invalid_json", 400);
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) throw new PricingError("invalid_proposal", 422);
    return pricingJson(await previewRate(user.id, parsed.data.proposal, parsed.data.purpose));
  } catch (error) { return pricingFailure(error); }
}
