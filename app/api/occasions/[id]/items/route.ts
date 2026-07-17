import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import {
  assertOccasionOwner,
  insertPulledOccasionItems,
} from "@/lib/occasion/server";
import { addPulledOccasionItemsSchema } from "@/lib/occasion/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface OccasionItemsRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: OccasionItemsRouteContext) {
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

  if (owner.occasion.status === "archived") {
    return jsonError("Archived occasions can't be edited.", 409);
  }

  const body = await readJson(request);
  const parsed = addPulledOccasionItemsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Select at least one item.", 400);
  }

  try {
    const items = await insertPulledOccasionItems({
      supabase,
      userId: user.id,
      occasionId: id,
      pulledItemIds: parsed.data.pulled_item_ids,
    });

    return NextResponse.json({ items }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("master_item_id")
    ) {
      return jsonError("Run the occasion wishlist migration before pulling items.", 409);
    }

    return jsonError("Couldn't add items. Try again.", 500);
  }
}
