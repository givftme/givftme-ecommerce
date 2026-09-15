"use client";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { formatPrice } from "@/lib/utils";

export interface PriceChange {
  title: string;
  old_price: number;
  new_price: number;
}

interface PriceChangeDialogProps {
  open: boolean;
  priceChanges: PriceChange[];
  onContinue: () => void;
}

// 18-FLASH-SALES.md Edge Case #2: a flash sale can end between page load
// and submit. The order is already created at the correct server price by
// the time this shows — this just makes sure the buyer isn't silently
// redirected to pay a different amount than what they last saw.
export function PriceChangeDialog({ open, priceChanges, onContinue }: PriceChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Heads up — some prices changed</DialogTitle>
          <DialogDescription>
            A flash sale ended while you were checking out. Your order has been placed
            at the current price.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 space-y-2 text-sm">
          {priceChanges.map((change) => (
            <li key={change.title} className="flex items-center justify-between gap-3">
              <span className="text-ink">{change.title}</span>
              <span className="text-muted">
                <span className="line-through">{formatPrice(change.old_price)}</span>{" "}
                <span className="font-semibold text-ink">
                  {formatPrice(change.new_price)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <Button type="button" fullWidth className="mt-6" onClick={onContinue}>
          Continue to pay
        </Button>
      </DialogContent>
    </Dialog>
  );
}
