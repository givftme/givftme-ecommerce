/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Gift } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { buttonVariants } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { cn, formatPrice } from "@/lib/utils";
import type { OrderCardData } from "@/lib/orders/types";

const MAX_THUMBNAILS = 3;

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function OrderCard({ order }: { order: OrderCardData }) {
  const shownItems = order.items.slice(0, MAX_THUMBNAILS);
  const extraCount = order.items.length - shownItems.length;
  const firstItem = order.items[0];

  return (
    <article className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Order #{order.id.slice(0, 9).toUpperCase()}</p>
          <p className="mt-1 text-xs text-muted">{formatDate(order.created_at, true)}</p>
          {order.estimated_delivery && <p className="mt-1 text-xs text-muted">Est. delivery: {formatDate(order.estimated_delivery)}</p>}
        </div>
        <OrderStatusBadge status={order.display_status} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {shownItems.map((item, index) => (
          <div key={`${order.id}-${index}`} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
            {item.product_image_url ? (
              <img src={item.product_image_url} alt="" className="h-full w-full object-cover" />
            ) : <Gift aria-hidden="true" className="h-4 w-4 text-muted" strokeWidth={1.7} />}
          </div>
        ))}
        {extraCount > 0 && <span className="text-xs font-medium text-muted">+{extraCount} more</span>}
      </div>

      {firstItem && (
        <p className="mt-3 truncate text-sm text-muted">
          {firstItem.product_title}{firstItem.quantity > 1 ? ` · Qty ${firstItem.quantity}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-ink">{formatPrice(order.total_amount)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {order.unreviewed_product_id && (
            <Link
              href={`/reviews/new?product_id=${encodeURIComponent(order.unreviewed_product_id)}&order_id=${encodeURIComponent(order.id)}`}
              onClick={() => trackEvent("account.orders.review_cta_clicked", { order_id: order.id })}
              className={cn(buttonVariants({ variant: "text", size: "sm" }))}
            >
              Leave a review
            </Link>
          )}
          <Link
            href={`/account/orders/${order.id}`}
            onClick={() => trackEvent("account.orders.detail_opened", { order_id: order.id, status: order.status })}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View Detail
          </Link>
        </div>
      </div>
    </article>
  );
}
