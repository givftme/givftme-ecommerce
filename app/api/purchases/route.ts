import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { purchaseConfirmationSchema } from "@/lib/wishlist/validation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = purchaseConfirmationSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid wishlist item.", 400);
  }

  const { data: item, error: itemError } = await supabase
    .from("wishlist_items_with_status")
    .select("id, origin, status")
    .eq("id", parsed.data.wishlist_item_id)
    .maybeSingle();

  if (itemError) {
    return jsonError("Couldn't verify this item.", 500);
  }

  const row = item as { id: string; origin: string; status: string } | null;

  if (!row || row.status === "archived") {
    return jsonError("This item doesn't exist or was removed.", 404);
  }

  if (row.status !== "available") {
    return jsonError("Someone just claimed this - they got there first!", 409);
  }

  if (row.origin !== "external") {
    return jsonError("Catalog gifts go through checkout.", 400);
  }

  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({
      wishlist_item_id: row.id,
      buyer_id: user.id,
    })
    .select("id, wishlist_item_id")
    .single();

  if (error?.code === "23505") {
    return jsonError("Someone just claimed this - they got there first!", 409);
  }

  if (error) {
    return jsonError("Couldn't confirm. Try again.", 500);
  }

  return NextResponse.json({ purchase }, { status: 201 });
}
