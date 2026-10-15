import { NextResponse } from "next/server";
import { recordRequestEvent } from "@/lib/events/server";
import { trackEvent } from "@/lib/analytics";
import { jsonError, readJson } from "@/lib/api/response";
import { getAppUrl } from "@/lib/env";
import { createPoolSchema } from "@/lib/pools/validation";
import { poolRpcError } from "@/lib/pools/errors";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const parsed = createPoolSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the pool details and try again.", 400);
  }

  const { data, error } = await supabase.rpc("gifvtme_create_group_gift_pool", {
    p_wishlist_id: parsed.data.wishlist_id,
    p_wishlist_item_id: parsed.data.wishlist_item_id ?? null,
    p_receiver_id: parsed.data.receiver_id,
    p_title: parsed.data.title ?? null,
    p_target_amount: parsed.data.target_amount,
    p_min_contribution: parsed.data.min_contribution,
    p_message: parsed.data.message ?? null,
    p_contributors_visible: parsed.data.contributors_visible,
  });

  if (error || !data || typeof data !== "object") {
    if (error) {
      const mapped = poolRpcError(error);
      if (mapped.status !== 500) return jsonError(mapped.error, mapped.status);
      console.error("Could not create group gift pool.", error);
    }
    return jsonError("Couldn't create this pool. Try again.", 500);
  }

  const pool = data as Record<string, unknown>;
  const token = String(pool.token ?? "");
  const poolId = String(pool.id ?? "");
  if (!token || !poolId) return jsonError("Couldn't create this pool. Try again.", 500);

  trackEvent("pool.created", {
    type: parsed.data.wishlist_item_id ? "item" : "general",
    target_amount: parsed.data.target_amount,
  });
  await recordRequestEvent({
    event: "pool_created",
    userId: user.id,
    props: {
      pool_id: poolId,
      wishlist_id: parsed.data.wishlist_id,
      type: parsed.data.wishlist_item_id ? "item" : "general",
      target_amount: parsed.data.target_amount,
    },
  });

  return NextResponse.json({
    pool,
    share_url: `${getAppUrl()}/pool/${token}`,
  }, { status: 201 });
}
