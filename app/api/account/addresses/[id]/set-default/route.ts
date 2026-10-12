import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const { id } = await context.params;
  const { data: address, error: lookupError } = await supabase.from("addresses")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return jsonError("Couldn't set as default. Please try again.", 500);
  if (!address) return jsonError("Address not found.", 404);

  const { data, error } = await supabase.rpc("gifvtme_update_address_defaults", {
    target_address_id: id,
    set_shipping_default: true,
    set_billing_default: null,
  });
  if (error || !data) return jsonError("Couldn't set as default. Please try again.", 500);

  return NextResponse.json({ updated: true });
}
