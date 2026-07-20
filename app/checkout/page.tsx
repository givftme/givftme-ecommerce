import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { SavedAddress } from "@/components/checkout/AddressSelector";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

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
  const savedAddresses: SavedAddress[] = [];

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
