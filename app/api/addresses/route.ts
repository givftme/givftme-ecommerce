import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { addressSchema } from "@/lib/account/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

const ADDRESS_SELECT = "id, user_id, label, first_name, last_name, phone, street_address, apt_suite_unit, city, state, postal_code, delivery_instructions, is_default, is_default_billing, created_at, updated_at";

async function setDefaults(supabase: Awaited<ReturnType<typeof createClient>>, addressId: string, shipping: boolean, billing: boolean) {
  if (!shipping && !billing) return null;
  const { data, error } = await supabase.rpc("gifvtme_update_address_defaults", {
    target_address_id: addressId,
    set_shipping_default: shipping ? true : null,
    set_billing_default: billing ? true : null,
  });
  if (error) return error;
  if (!data) return new Error("Address ownership could not be confirmed.");
  return null;
}

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const { data, error } = await supabase.from("addresses")
    .select(ADDRESS_SELECT)
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return jsonError("Couldn't load your addresses.", 500);
  return NextResponse.json({ addresses: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const parsed = addressSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Check your address details and try again.", 400);

  const { is_default, is_default_billing, ...fields } = parsed.data;
  const { data: created, error: createError } = await supabase.from("addresses")
    .insert({
      ...fields,
      phone: fields.phone || null,
      apt_suite_unit: fields.apt_suite_unit || null,
      postal_code: fields.postal_code || null,
      delivery_instructions: fields.delivery_instructions || null,
      user_id: user.id,
      is_default: false,
      is_default_billing: false,
    })
    .select(ADDRESS_SELECT)
    .single();

  if (createError || !created) return jsonError("Couldn't save address. Try again.", 500);

  const defaultError = await setDefaults(supabase, created.id, is_default, is_default_billing);
  if (defaultError) {
    await supabase.from("addresses").delete().eq("id", created.id).eq("user_id", user.id);
    return jsonError("Couldn't save address. Try again.", 500);
  }

  const { data: address, error: readError } = await supabase.from("addresses")
    .select(ADDRESS_SELECT).eq("id", created.id).eq("user_id", user.id).single();
  if (readError || !address) return jsonError("Couldn't save address. Try again.", 500);
  return NextResponse.json({ address }, { status: 201 });
}
