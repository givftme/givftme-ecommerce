import type { CartItem } from "@/components/cart/CartContext";
import { formatPrice } from "@/lib/utils";

interface OrderSummaryPanelProps {
  items: CartItem[];
  total: number;
}

export function OrderSummaryPanel({ items, total }: OrderSummaryPanelProps) {
  return (
    <aside className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm lg:sticky lg:top-36">
      <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3 text-sm font-semibold text-ink">
        <span>Product</span>
        <span>Subtotal</span>
      </div>

      <div className="divide-y divide-stone-100">
        {items.map((item) => (
          <div
            key={`${item.catalog_product_id}-${item.combination_key || "base"}`}
            className="flex items-start justify-between gap-4 py-4 text-sm"
          >
            <p className="min-w-0 truncate text-muted">
              <span className="font-medium text-ink">{item.product_title}</span>{" "}
              x {item.quantity}
            </p>
            <p className="font-semibold text-ink">
              {formatPrice(item.unit_price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <dl className="space-y-3 border-t border-stone-100 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-semibold text-ink">{formatPrice(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd className="font-semibold text-green-700">FREE</dd>
        </div>
        <div className="flex items-end justify-between border-t border-stone-100 pt-4">
          <dt className="text-base font-semibold text-ink">Total</dt>
          <dd className="text-xl font-bold text-brand">{formatPrice(total)}</dd>
        </div>
      </dl>
    </aside>
  );
}
