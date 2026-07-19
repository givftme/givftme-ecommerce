import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface FlagIntentRouteContext {
  params: Promise<{ itemId: string }>;
}

function intentErrorMessage(message?: string) {
  if (message?.includes("already_flagged")) {
    return {
      error: "Someone else has flagged this - you can still buy it",
      status: 409,
    };
  }

  if (message?.includes("not_available")) {
    return { error: "This item is no longer available", status: 404 };
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

  const { error } = await supabase.rpc("gifvtme_flag_wishlist_item_intent", {
    p_item_id: itemId,
  });

  if (error) {
    const mapped = intentErrorMessage(error.message);
    return jsonError(mapped.error, mapped.status);
  }

  return NextResponse.json({ ok: true });
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

  return NextResponse.json({ ok: true });
}
