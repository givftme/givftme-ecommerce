import { PriceDisplay } from "@/components/ui/PriceDisplay";
import type { GiftEstimate } from "@/lib/pricing/types";

export function GiftPriceEstimate({ estimate }: { estimate: GiftEstimate }) {
  return <div className="space-y-2 rounded-xl bg-surface p-4" aria-live="polite">
    {estimate.state === "estimate" && estimate.gift_price_ngn !== null ? <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Gift estimate</p>
      <PriceDisplay price={Number(estimate.gift_price_ngn)} size="lg" />
      <p className="text-sm text-muted">Delivery awaits confirmation. The gift and final total must be confirmed before you can pay through Gifvtme.</p>
    </> : <>
      <p className="text-sm font-medium text-ink">Gift pricing is unavailable</p>
      <p className="text-sm text-muted">A price and delivery charge still need confirmation.</p>
    </>}
  </div>;
}
