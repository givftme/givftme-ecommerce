import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { assertOccasionOwner, resolveReactivationPrompt } from "@/lib/occasion/server";
import { reactivateItemsSchema } from "@/lib/occasion/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ReactivateRouteContext {
  params: Promise<{ id: string }>;
}

interface ReactivationCandidateRow {
  master_item_id: string | null;
}

export async function POST(request: Request, context: ReactivateRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertOccasionOwner>>;

  try {
    owner = await assertOccasionOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify occasion access.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  if (owner.occasion.status !== "archived") {
    return jsonError("Only archived occasions can reactivate items.", 409);
  }

  const body = await readJson(request);
  const parsed = reactivateItemsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid item selection.", 400);
  }

  const requestedItemIds = [...new Set(parsed.data.item_ids)];

  if (requestedItemIds.length > 0) {
    const { data: wishlist, error: wishlistError } = await supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "occasion")
      .eq("occasion_id", id)
      .maybeSingle();

    if (wishlistError) {
      return jsonError("Couldn't verify occasion wishlist. Try again.", 500);
    }

    if (!wishlist) {
      return jsonError("Occasion wishlist not found.", 404);
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from("wishlist_items_with_status")
      .select("master_item_id")
      .eq("wishlist_id", (wishlist as { id: string }).id)
      .eq("status", "purchased")
      .eq("is_exclusive", false)
      .in("master_item_id", requestedItemIds)
      .returns<ReactivationCandidateRow[]>();

    if (candidatesError) {
      return jsonError("Couldn't verify purchased occasion items. Try again.", 500);
    }

    const eligibleMasterItemIds = [
      ...new Set((candidates || []).map((item) => item.master_item_id).filter(Boolean)),
    ] as string[];

    if (eligibleMasterItemIds.length > 0) {
      const { error } = await supabase
        .from("master_items")
        .update({ status: "available" })
        .in("id", eligibleMasterItemIds)
        .eq("user_id", user.id)
        .eq("status", "purchased");

      if (error) {
        return jsonError("Couldn't reactivate items. Try again.", 500);
      }
    }
  }

  // Reaching here means the user made a decision (reactivate some, or keep the
  // rest as purchased) — either way the prompt is resolved, not just an empty selection.
  await resolveReactivationPrompt({ supabase, userId: user.id, occasionId: id });

  return NextResponse.json({ ok: true });
}
