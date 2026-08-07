import Link from "next/link";
import { Gift } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { buttonVariants } from "@/components/ui/Button";
import { cn, formatPrice } from "@/lib/utils";
import type { OrderCardData } from "@/lib/orders/types";

const MAX_THUMBNAILS = 3;

function formatDatePlaced(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function OrderCard({ order }: { order: OrderCardData }) {
  const shownItems = order.items.slice(0, MAX_THUMBNAILS);
  const extraCount = order.items.length - shownItems.length;

  return (
    <article className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            Order #{order.id.slice(-8).toUpperCase()}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDatePlaced(order.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {shownItems.map((item, index) => (
          <div
            key={`${order.id}-${index}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface"
          >
            {item.product_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.product_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Gift className="h-5 w-5 text-muted" strokeWidth={1.7} />
            )}
          </div>
        ))}
        {extraCount > 0 && (
          <span className="text-xs font-medium text-muted">
            +{extraCount} more
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
        <p className="text-sm font-semibold text-ink">
          {formatPrice(order.total_amount)}
        </p>
        <Link
          href={`/account/orders/${order.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          View order
        </Link>
      </div>
    </article>
  );
}
