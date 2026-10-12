import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { jsonError } from "@/lib/api/response";
import { poolRpcError } from "@/lib/pools/errors";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface PoolActionContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: PoolActionContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const { data, error } = await supabase.rpc("gifvtme_cancel_group_gift_pool", { p_pool_id: id });
  if (error) {
    const mapped = poolRpcError(error);
    if (mapped.status !== 500) return jsonError(mapped.error, mapped.status);
    console.error("Could not cancel group gift pool.", error);
    return jsonError(mapped.error, mapped.status);
  }

  if (!data || typeof data !== "object" || (data as { cancelled?: boolean }).cancelled !== true) {
    return jsonError("Couldn't cancel this pool.", 500);
  }
  trackEvent("pool.cancelled", { pool_id: id });
  return NextResponse.json({ cancelled: true });
}
