"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { OrderCard } from "@/components/order/OrderCard";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { OrderCardData, OrderStatusGroup } from "@/lib/orders/types";

const TABS: { id: OrderStatusGroup; label: string; emptyLabel: string }[] = [
  { id: "active", label: "Active", emptyLabel: "active" },
  { id: "completed", label: "Completed", emptyLabel: "completed" },
  { id: "cancelled", label: "Cancelled", emptyLabel: "cancelled" },
];

function matchesTab(order: OrderCardData, tab: OrderStatusGroup) {
  if (tab === "active") {
    return ["confirmed", "under_review", "forwarded", "shipped"].includes(
      order.status,
    );
  }
  if (tab === "completed") {
    return order.status === "delivered";
  }
  return ["cancelled", "refunded"].includes(order.status);
}

export function OrderList({ orders }: { orders: OrderCardData[] }) {
  const [tab, setTab] = useState<OrderStatusGroup>("active");

  const filtered = useMemo(
    () => orders.filter((order) => matchesTab(order, tab)),
    [orders, tab],
  );

  useEffect(() => {
    trackEvent("orders.list.viewed", { tab });
  }, [tab]);

  return (
    <>
      <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === option.id ? "bg-brand text-white" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="mt-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white px-4 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
              <Package className="h-8 w-8 text-brand" strokeWidth={1.7} />
            </div>
            <p className="mt-5 text-sm text-muted">
              No {TABS.find((option) => option.id === tab)?.emptyLabel} orders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
