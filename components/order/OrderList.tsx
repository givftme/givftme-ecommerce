"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Loader2, Package } from "lucide-react";
import { OrderCard } from "@/components/order/OrderCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { OrderCardData, OrderStatusGroup } from "@/lib/orders/types";
import type { OrderPage } from "@/lib/orders/server";

const TABS: { id: OrderStatusGroup; label: string; emptyLabel: string }[] = [
  { id: "active", label: "Active", emptyLabel: "No active orders" },
  { id: "completed", label: "Completed", emptyLabel: "No completed orders yet" },
  { id: "cancelled", label: "Cancelled", emptyLabel: "No cancelled orders" },
];

type TabPages = Record<OrderStatusGroup, OrderPage | null>;
type TabCounts = Record<OrderStatusGroup, number>;

function OrderSkeletons() {
  return <div className="space-y-3" aria-label="Loading orders">
    {[0, 1, 2].map((item) => <Skeleton key={item} className="h-44 w-full rounded-2xl" />)}
  </div>;
}

export function OrderList({ initialPage, counts }: { initialPage: OrderPage; counts: TabCounts }) {
  const [tab, setTab] = useState<OrderStatusGroup>("active");
  const [pages, setPages] = useState<TabPages>({ active: initialPage, completed: null, cancelled: null });
  const [loadingTab, setLoadingTab] = useState<OrderStatusGroup | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const { toast } = useToast();
  const page = pages[tab];

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-order-content]", { autoAlpha: 0, y: 10, duration: 0.2 });
      gsap.from("[data-order-card]", { autoAlpha: 0, y: 20, stagger: 0.06, duration: 0.3 });
    });
    return () => media.revert();
  }, { scope: contentRef, dependencies: [tab, page?.orders], revertOnUpdate: true });

  const requestPage = async (requestedTab: OrderStatusGroup, requestedPage: number) => {
    const response = await fetch(`/api/orders?tab=${requestedTab}&page=${requestedPage}`, { cache: "no-store" });
    const result = await response.json() as OrderPage & { error?: string };
    if (!response.ok) throw new Error(result.error || "Couldn't load your orders. Try again.");
    return result;
  };

  const selectTab = async (nextTab: OrderStatusGroup) => {
    setTab(nextTab);
    trackEvent("account.orders.viewed", { tab: nextTab, order_count: counts[nextTab] });
    if (pages[nextTab]) return;
    if (counts[nextTab] === 0) {
      setPages((current) => ({ ...current, [nextTab]: { orders: [], count: 0, page: 1, has_more: false } }));
      return;
    }
    setLoadingTab(nextTab);
    try {
      const result = await requestPage(nextTab, 1);
      setPages((current) => ({ ...current, [nextTab]: result }));
    } catch {
      toast({ title: "Couldn't load orders. Try again.", variant: "danger" });
    } finally {
      setLoadingTab((current) => current === nextTab ? null : current);
    }
  };

  const loadMore = async () => {
    if (!page || loadingMore || !page.has_more) return;
    const nextPage = page.page + 1;
    setLoadingMore(true);
    trackEvent("account.orders.load_more", { tab, page: nextPage });
    try {
      const result = await requestPage(tab, nextPage);
      setPages((current) => {
        const existing = current[tab];
        if (!existing) return { ...current, [tab]: result };
        const uniqueOrders = new Map<string, OrderCardData>();
        for (const order of [...existing.orders, ...result.orders]) uniqueOrders.set(order.id, order);
        return { ...current, [tab]: { ...result, orders: [...uniqueOrders.values()] } };
      });
    } catch {
      toast({ title: "Couldn't load more orders. Try again.", variant: "danger" });
    } finally {
      setLoadingMore(false);
    }
  };

  const isLoadingSelectedTab = loadingTab === tab;

  return (
    <div>
      <div role="tablist" aria-label="Order status" className="flex gap-5 border-b border-stone-200">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => void selectTab(option.id)}
            className={cn(
              "min-h-12 border-b-2 px-1 text-sm font-medium transition-colors",
              tab === option.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {option.label} ({counts[option.id]})
          </button>
        ))}
      </div>

      <section ref={contentRef} role="tabpanel" data-order-content className="mt-5" aria-live="polite">
        {isLoadingSelectedTab ? <OrderSkeletons /> : page?.orders.length ? (
          <>
            <div className="space-y-3">
              {page.orders.map((order) => <div key={order.id} data-order-card><OrderCard order={order} /></div>)}
            </div>
            {page.has_more && (
              <Button variant="ghost" fullWidth className="mt-5" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</> : "Load more"}
              </Button>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-stone-100 bg-white px-4 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
              <Package aria-hidden="true" className="h-8 w-8 text-muted" strokeWidth={1.7} />
            </div>
            <p className="mt-5 text-sm text-muted">{TABS.find((option) => option.id === tab)?.emptyLabel}</p>
          </div>
        )}
      </section>
    </div>
  );
}
