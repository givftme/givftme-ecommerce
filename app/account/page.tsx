import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

interface AccountOrderRow {
  id: string;
  status: string;
  total_amount: number;
  created_at: string | null;
  order_items?: Array<{ id: string }>;
}

function getStatusVariant(status: string) {
  if (status === "confirmed" || status === "delivered") {
    return "success" as const;
  }

  if (status === "payment_failed" || status === "cancelled" || status === "refunded") {
    return "danger" as const;
  }

  return "muted" as const;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", "/account"));
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, order_items(id)")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const orders = (data || []) as AccountOrderRow[];

  return (
    <PageWrapper isAuthenticated>
      <section className="bg-surface py-10">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h1 className="text-3xl font-bold text-ink">My orders</h1>
          <p className="mt-2 text-sm text-muted">
            Recent catalog orders and payment status.
          </p>

          {orders.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-stone-100 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-muted">No orders yet.</p>
              <Link
                href="/shop"
                className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
              >
                Explore items
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="block rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-colors hover:border-brand/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {order.order_items?.length || 0}{" "}
                        {(order.order_items?.length || 0) === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">
                        {formatPrice(order.total_amount)}
                      </p>
                      <Badge
                        variant={getStatusVariant(order.status)}
                        className="mt-2 capitalize"
                      >
                        {formatStatus(order.status)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageWrapper>
  );
}
