import { redirect } from "next/navigation";
import { AddressBookClient } from "@/components/address/AddressBookClient";
import { trackEvent } from "@/lib/analytics";
import { withRedirect } from "@/lib/auth/redirect";
import type { SavedAddressRecord } from "@/lib/account/types";
import { createClient } from "@/lib/supabase/server";

export default async function AddressesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(withRedirect("/login", "/account/addresses"));

  const { data, error } = await supabase.from("addresses")
    .select("id, user_id, label, first_name, last_name, phone, street_address, apt_suite_unit, city, state, postal_code, delivery_instructions, is_default, is_default_billing, created_at, updated_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error("Couldn't load your addresses. Please try again.");
  const addresses = (data ?? []) as unknown as SavedAddressRecord[];
  trackEvent("account.addresses.viewed", { address_count: addresses.length });

  return <AddressBookClient initialAddresses={addresses} />;
}
