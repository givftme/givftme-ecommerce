import { redirect } from "next/navigation";
import { OrderList } from "@/components/order/OrderList";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { getOrdersForUser } from "@/lib/orders/server";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", "/account/orders"));
  }

  const orders = await getOrdersForUser(supabase, user.id);

  return (
    <PageWrapper isAuthenticated>
      <section className="bg-surface py-10">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h1 className="text-3xl font-bold text-ink">My orders</h1>
          <p className="mt-2 text-sm text-muted">
            Track every order you&apos;ve placed, from confirmation to delivery.
          </p>

          <div className="mt-6">
            <OrderList orders={orders} />
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
