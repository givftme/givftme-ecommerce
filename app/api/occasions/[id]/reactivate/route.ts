import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { assertOccasionOwner } from "@/lib/occasion/server";
import { reactivateItemsSchema } from "@/lib/occasion/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ReactivateRouteContext {
  params: Promise<{ id: string }>;
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

  const body = await readJson(request);
  const parsed = reactivateItemsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid item selection.", 400);
  }

  if (parsed.data.item_ids.length > 0) {
    const { error } = await supabase
      .from("master_items")
      .update({ status: "available" })
      .in("id", parsed.data.item_ids)
      .eq("user_id", user.id);

    if (error) {
      return jsonError("Couldn't reactivate items. Try again.", 500);
    }
  }

  return NextResponse.json({ ok: true });
}
