import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { OrderList } from "@/components/order/OrderList";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { withRedirect } from "@/lib/auth/redirect";
import { getOrderCountsForUser, getOrderPageForUser } from "@/lib/orders/server";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", "/account/orders"));
  }

  const [initialPage, counts] = await Promise.all([
    getOrderPageForUser(supabase, user.id, "active", 1),
    getOrderCountsForUser(supabase, user.id),
  ]);
  trackEvent("account.orders.viewed", { tab: "active", order_count: initialPage.count });
  const hasOrders = counts.active + counts.completed + counts.cancelled > 0;

  return (
    <div className="mx-auto max-w-[800px]">
      <h1 className="text-2xl font-bold text-ink md:text-3xl">My Orders</h1>
      <p className="mt-2 text-sm text-muted">Track every order you&apos;ve placed, from confirmation to delivery.</p>

      <div className="mt-6">
        {hasOrders ? <OrderList initialPage={initialPage} counts={counts} /> : (
          <div className="rounded-2xl border border-stone-100 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
              <ShoppingBag aria-hidden="true" className="h-10 w-10 text-muted" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-ink">You haven&apos;t placed any orders yet</h2>
            <Link href="/shop" className={cn(buttonVariants(), "mt-5")}>Browse the gift museum</Link>
          </div>
        )}
      </div>
    </div>
  );
}
