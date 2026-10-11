import { NextResponse } from "next/server";
import { addressPatchSchema } from "@/lib/account/validation";
import { jsonError, readJson } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

const ADDRESS_SELECT = "id, user_id, label, first_name, last_name, phone, street_address, apt_suite_unit, city, state, postal_code, delivery_instructions, is_default, is_default_billing, created_at, updated_at";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);
  const { id } = await context.params;

  const parsed = addressPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Check your address details and try again.", 400);

  const { data: existing, error: lookupError } = await supabase.from("addresses")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return jsonError("Couldn't update address. Try again.", 500);
  if (!existing) return jsonError("Address not found.", 404);

  const values = { ...parsed.data };
  const hasShippingDefaultUpdate = typeof values.is_default === "boolean";
  const hasBillingDefaultUpdate = typeof values.is_default_billing === "boolean";
  if (hasShippingDefaultUpdate || hasBillingDefaultUpdate) {
    const { data, error } = await supabase.rpc("gifvtme_update_address_defaults", {
      target_address_id: id,
      set_shipping_default: hasShippingDefaultUpdate ? values.is_default : null,
      set_billing_default: hasBillingDefaultUpdate ? values.is_default_billing : null,
    });
    const defaultError = error || (!data ? new Error("Address ownership could not be confirmed.") : null);
    if (defaultError) return jsonError("Couldn't update address. Try again.", 500);
  }

  const update: Record<string, unknown> = { ...values };
  delete update.is_default;
  delete update.is_default_billing;
  for (const field of ["phone", "apt_suite_unit", "postal_code", "delivery_instructions"] as const) {
    if (field in values && values[field] === "") update[field] = null;
  }
  const addressQuery = supabase.from("addresses").select(ADDRESS_SELECT).eq("id", id).eq("user_id", user.id);
  const { data: address, error } = Object.keys(update).length > 0
    ? await supabase.from("addresses").update(update).eq("id", id).eq("user_id", user.id).select(ADDRESS_SELECT).maybeSingle()
    : await addressQuery.maybeSingle();

  if (error) return jsonError("Couldn't update address. Try again.", 500);
  if (!address) return jsonError("Address not found.", 404);
  return NextResponse.json({ address });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);
  const { id } = await context.params;

  const { data: address, error: lookupError } = await supabase.from("addresses")
    .select("id, is_default, is_default_billing")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return jsonError("Couldn't remove address. Try again.", 500);
  if (!address) return jsonError("Address not found.", 404);

  const { error: deleteError } = await supabase.from("addresses")
    .delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) return jsonError("Couldn't remove address. Try again.", 500);

  // Promote the newest remaining address for each default role it had held.
  // If a promotion fails, deletion still succeeds and the user may proceed
  // with no default address (the checkout form remains editable).
  if (address.is_default || address.is_default_billing) {
    const { data: remaining } = await supabase.from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (remaining) {
      await supabase.rpc("gifvtme_update_address_defaults", {
        target_address_id: remaining.id,
        set_shipping_default: address.is_default ? true : null,
        set_billing_default: address.is_default_billing ? true : null,
      });
    }
  }

  const { data: addresses } = await supabase.from("addresses")
    .select(ADDRESS_SELECT)
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return NextResponse.json({ success: true, addresses: addresses ?? [] });
}
