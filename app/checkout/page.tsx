import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { SavedAddress } from "@/components/checkout/AddressSelector";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Checkout", robots: NO_INDEX };

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" ? value.trim() : "";
}

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", "/checkout"));
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const { data: rawAddresses, error: addressError } = await supabase.from("addresses")
    .select("id, label, first_name, last_name, phone, street_address, apt_suite_unit, city, state, postal_code, delivery_instructions, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (addressError) throw new Error("Couldn't load your saved addresses.");

  const savedAddresses: SavedAddress[] = (rawAddresses ?? []).map((address) => ({
    id: address.id,
    label: address.label,
    first_name: address.first_name,
    last_name: address.last_name,
    email: user.email || "",
    phone: address.phone || "",
    street_address: address.street_address,
    apartment: address.apt_suite_unit || "",
    city: address.city,
    state: address.state,
    postal_code: address.postal_code || "",
    delivery_instructions: address.delivery_instructions || "",
    is_default: address.is_default,
  }));

  return (
    <PageWrapper isAuthenticated userName={getMetadataString(metadata, "first_name")}>
      <CheckoutForm
        initialEmail={user.email || ""}
        initialFirstName={
          getMetadataString(metadata, "first_name") ||
          getMetadataString(metadata, "given_name")
        }
        initialLastName={
          getMetadataString(metadata, "last_name") ||
          getMetadataString(metadata, "family_name")
        }
        savedAddresses={savedAddresses}
      />
    </PageWrapper>
  );
}
