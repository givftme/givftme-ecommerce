import type { OrderDisplayStatus } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

const STATUS_DISPLAY: Record<OrderDisplayStatus, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting Payment", className: "bg-secondary text-secondary-foreground" },
  payment_expired: { label: "Payment Expired", className: "bg-secondary text-secondary-foreground" },
  payment_failed: { label: "Payment Failed", className: "bg-danger/10 text-danger" },
  confirmed: { label: "Confirmed", className: "bg-primary text-primary-foreground" },
  under_review: { label: "Under Review", className: "bg-primary text-primary-foreground" },
  forwarded: { label: "Processing", className: "bg-primary text-primary-foreground" },
  shipped: { label: "Shipped", className: "bg-warning/10 text-warning" },
  delivered: { label: "Delivered", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", className: "bg-secondary text-secondary-foreground" },
  refunded: { label: "Refunded", className: "bg-secondary text-secondary-foreground" },
};

export function OrderStatusBadge({ status }: { status: OrderDisplayStatus }) {
  const { label, className } = STATUS_DISPLAY[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", className)}>
      {label}
    </span>
  );
}
