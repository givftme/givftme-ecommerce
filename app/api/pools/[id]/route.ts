import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { poolRpcError } from "@/lib/pools/errors";
import { getPoolPageData } from "@/lib/pools/server";
import { poolTokenSchema, updatePoolTitleSchema } from "@/lib/pools/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface PoolRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: PoolRouteContext) {
  const { id: token } = await context.params;
  if (!poolTokenSchema.safeParse(token).success) return jsonError("This pool couldn't be found.", 404);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const page = await getPoolPageData(token, user?.id ?? null);
    if (!page) return jsonError("This pool couldn't be found.", 404);

    return NextResponse.json({
      pool: {
        id: page.pool.id,
        wishlist_item_id: page.pool.wishlist_item_id,
        title: page.pool.title,
        message: page.pool.message,
        target_amount: page.pool.target_amount,
        amount_raised: page.pool.amount_raised,
        min_contribution: page.pool.min_contribution,
        status: page.pool.status,
        contributors_visible: page.pool.contributors_visible,
        fully_funded_at: page.pool.fully_funded_at,
        cashed_out_at: page.pool.cashed_out_at,
        cashed_out_amount: page.pool.cashed_out_amount,
        created_at: page.pool.created_at,
      },
      wishlist_title: page.wishlist_title,
      receiver: page.receiver,
      creator: page.creator,
      item: page.item,
      contributor_count: page.contributor_count,
      contributors: page.contributors,
      viewer_is_manager: page.viewer_is_manager,
    });
  } catch (error) {
    console.error("Could not load public group gift pool.", error);
    return jsonError("Couldn't load this pool. Try again.", 500);
  }
}

export async function PATCH(request: Request, context: PoolRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const parsed = updatePoolTitleSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("Pool title must be between 3 and 100 characters.", 400);
  }

  const { data, error } = await supabase.rpc("gifvtme_update_group_gift_pool_title", {
    p_pool_id: id,
    p_title: parsed.data.title,
  });
  if (error) {
    const mapped = poolRpcError(error);
    if (mapped.status !== 500) return jsonError(mapped.error, mapped.status);
    console.error("Could not update group gift pool title.", error);
    return jsonError(mapped.error, mapped.status);
  }

  if (!data || typeof data !== "object" || (data as { updated?: boolean }).updated !== true) {
    return jsonError("Couldn't update this pool title.", 500);
  }
  return NextResponse.json({ updated: true });
}
