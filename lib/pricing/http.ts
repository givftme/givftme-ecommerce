import { getAdminApiUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { PricingError } from "./preview";
import { requestKeySchema } from "./validation";

export function pricingJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function pricingFailure(error: unknown) {
  if (error instanceof PricingError) return pricingJson({ error: error.code }, error.status);
  console.error("pricing.operation_failed");
  return pricingJson({ error: "pricing_unavailable" }, 503);
}

export async function authorizePricingAdmin(request?: Request) {
  const user = await getAdminApiUser(await createClient());
  if (!user) throw new PricingError("admin_access_required", 403);
  if (request) {
    const origin = request.headers.get("origin");
    const expected = process.env.NEXT_APP_URL ? new URL(process.env.NEXT_APP_URL).origin : new URL(request.url).origin;
    if (origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new PricingError("same_origin_required", 403);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new PricingError("json_required", 415);
    if (!requestKeySchema.safeParse(request.headers.get("idempotency-key")).success) throw new PricingError("idempotency_key_required", 422);
  }
  return user;
}
