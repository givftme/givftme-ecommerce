import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface FlagIntentRouteContext {
  params: Promise<{ itemId: string }>;
}

function intentErrorMessage(message?: string) {
  if (message?.includes("already_purchased")) {
    return { error: "This item has already been purchased.", status: 409 };
  }

  if (message?.includes("not_found")) {
    return { error: "This item doesn't exist or was removed.", status: 404 };
  }

  if (message?.includes("not_available")) {
    return { error: "This item is no longer available", status: 409 };
  }

  return { error: "Couldn't update intent.", status: 500 };
}

export async function POST(_request: Request, context: FlagIntentRouteContext) {
  const { itemId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const { data, error } = await supabase.rpc("gifvtme_flag_wishlist_item_intent", {
    p_item_id: itemId,
  });

  if (error) {
    const mapped = intentErrorMessage(error.message);
    return jsonError(mapped.error, mapped.status);
  }

  const result = data as { warning?: string; flagged_at?: string } | null;

  if (result?.warning === "already_flagged") {
    return NextResponse.json({
      warning: "already_flagged",
      flagged_at: result.flagged_at,
    });
  }

  return NextResponse.json({ flagged: true });
}

export async function DELETE(_request: Request, context: FlagIntentRouteContext) {
  const { itemId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const { error } = await supabase.rpc("gifvtme_clear_wishlist_item_intent", {
    p_item_id: itemId,
  });

  if (error) {
    return jsonError("Couldn't clear intent.", 500);
  }

  return NextResponse.json({ cleared: true });
}
