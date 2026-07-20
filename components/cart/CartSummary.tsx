import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import type { CartItem } from "@/components/cart/CartContext";
import { cn, formatPrice } from "@/lib/utils";
import { withRedirect } from "@/lib/auth/redirect";

interface CartSummaryProps {
  items: CartItem[];
  total: number;
  isAuthenticated: boolean;
  disabled?: boolean;
}

export function CartSummary({
  items,
  total,
  isAuthenticated,
  disabled,
}: CartSummaryProps) {
  return (
    <aside className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm lg:sticky lg:top-36">
      <h2 className="text-lg font-semibold text-ink">Order Summary</h2>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.catalog_product_id}-${item.combination_key || "base"}`}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {item.product_title}
              </p>
              <p className="mt-1 text-xs text-muted">Qty {item.quantity}</p>
            </div>
            <p className="shrink-0 font-semibold text-ink">
              {formatPrice(item.unit_price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <dl className="mt-6 space-y-3 border-t border-stone-100 pt-5 text-sm">
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

      <Link
        href={
          isAuthenticated ? "/checkout" : withRedirect("/login", "/checkout")
        }
        aria-disabled={disabled || items.length === 0}
        tabIndex={disabled || items.length === 0 ? -1 : undefined}
        onClick={(e) => {
          if (disabled || items.length === 0) e.preventDefault();
        }}
        className={cn(
          buttonVariants({ fullWidth: true }),
          "mt-6",
          (disabled || items.length === 0) && "pointer-events-none opacity-50",
        )}
      >
        {isAuthenticated ? "Checkout" : "Sign in to checkout"}
      </Link>
    </aside>
  );
}
