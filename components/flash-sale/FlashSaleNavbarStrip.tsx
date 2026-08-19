"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { FlashSaleTimer } from "@/components/flash-sale/FlashSaleTimer";
import { trackEvent } from "@/lib/analytics";

interface FlashSaleNavbarStripProps {
  saleEndTime?: string | null;
  maxDiscountPercent?: number | null;
}

export function FlashSaleNavbarStrip({
  saleEndTime,
  maxDiscountPercent,
}: FlashSaleNavbarStripProps) {
  if (!saleEndTime) {
    return null;
  }

  return (
    <div className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold sm:text-sm">
        <Zap className="h-3.5 w-3.5 shrink-0" fill="currentColor" />
        <span>
          Flash Sale
          {maxDiscountPercent ? ` – Up to ${maxDiscountPercent}% off` : null}
          {" · Ends in "}
          <FlashSaleTimer
            endTime={saleEndTime}
            className="inline-block text-white"
            disableUrgencyColor
          />
        </span>
        <Link
          href="/flash-sale"
          onClick={() => trackEvent("museum.flash_sale_strip.clicked")}
          className="underline decoration-white/60 underline-offset-2 transition-opacity hover:opacity-80"
        >
          Shop now
        </Link>
      </div>
    </div>
  );
}
