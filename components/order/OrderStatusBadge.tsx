import type { OrderDisplayStatus } from "@/lib/orders/types";

const STATUS_DISPLAY: Record<OrderDisplayStatus, { label: string; bg: string; text: string }> = {
  pending_payment: { label: "Awaiting Payment", bg: "#F3F4F6", text: "#374151" },
  payment_expired: { label: "Payment Expired", bg: "#F3F4F6", text: "#374151" },
  payment_failed: { label: "Payment Failed", bg: "#FEE2E2", text: "#991B1B" },
  confirmed: { label: "Confirmed", bg: "#C50404", text: "#FFFFFF" },
  under_review: { label: "Under Review", bg: "#C50404", text: "#FFFFFF" },
  forwarded: { label: "Processing", bg: "#C50404", text: "#FFFFFF" },
  shipped: { label: "Shipped", bg: "#FEF3C7", text: "#92400E" },
  delivered: { label: "Delivered", bg: "#D1FAE5", text: "#065F46" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", text: "#374151" },
  refunded: { label: "Refunded", bg: "#F3F4F6", text: "#374151" },
};

export function OrderStatusBadge({ status }: { status: OrderDisplayStatus }) {
  const { label, bg, text } = STATUS_DISPLAY[status];
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>
      {label}
    </span>
  );
}
