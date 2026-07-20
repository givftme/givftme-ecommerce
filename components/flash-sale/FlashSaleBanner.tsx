"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { FlashSaleTimer } from "@/components/flash-sale/FlashSaleTimer";
import { trackEvent } from "@/lib/analytics";

interface FlashSaleBannerProps {
  saleEndTime?: string | null;
}

export function FlashSaleBanner({ saleEndTime }: FlashSaleBannerProps) {
  if (!saleEndTime) {
    return null;
  }

  return (
    <section className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="flex items-center gap-3 text-sm font-semibold sm:text-base">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand">
            <Zap className="h-5 w-5" fill="currentColor" />
          </span>
          <span>
            Flash Sale - ends in{" "}
            <FlashSaleTimer endTime={saleEndTime} className="inline-block" />
          </span>
        </div>
        <Link
          href="/flash-sale"
          onClick={() => trackEvent("museum.flash_sale_banner.clicked")}
          className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
        >
          Shop now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
