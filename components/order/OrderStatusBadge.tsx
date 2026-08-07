import { Badge, type BadgeProps } from "@/components/ui/Badge";
import type { OrderStatus } from "@/lib/orders/types";

const STATUS_DISPLAY: Record<
  OrderStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]> }
> = {
  pending_payment: { label: "Payment pending", variant: "muted" },
  payment_failed: { label: "Payment failed", variant: "danger" },
  confirmed: { label: "Processing", variant: "warning" },
  under_review: { label: "Processing", variant: "warning" },
  forwarded: { label: "Processing", variant: "warning" },
  shipped: { label: "Shipped", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  refunded: { label: "Refunded", variant: "danger" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, variant } = STATUS_DISPLAY[status];
  return <Badge variant={variant}>{label}</Badge>;
}
