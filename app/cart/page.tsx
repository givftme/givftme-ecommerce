import { CartPageClient } from "@/components/cart/CartPageClient";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { createClient } from "@/lib/supabase/server";

export default async function CartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageWrapper isAuthenticated={Boolean(user)}>
      <CartPageClient isAuthenticated={Boolean(user)} />
    </PageWrapper>
  );
}
