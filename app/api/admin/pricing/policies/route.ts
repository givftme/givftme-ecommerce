import { authorizePricingAdmin, pricingFailure, pricingJson } from "@/lib/pricing/http";
import { PricingError } from "@/lib/pricing/preview";
import { getPolicies } from "@/lib/pricing/server";

export async function GET(request: Request) {
  try {
    await authorizePricingAdmin();
    const cursor = new URL(request.url).searchParams.get("cursor") || "0";
    if (!/^(0|[1-9]\d{0,8})$/.test(cursor)) throw new PricingError("invalid_cursor", 422);
    return pricingJson(await getPolicies(Number(cursor)));
  } catch (error) { return pricingFailure(error); }
}
