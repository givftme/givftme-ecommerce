"use client";

import { Gift as GiftIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { GiftReceived } from "@/lib/thank-you/types";

function formatPurchasedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function GiftCard({
  gift,
  onSendThankYou,
}: {
  gift: GiftReceived;
  onSendThankYou: (gift: GiftReceived) => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
        {gift.itemImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gift.itemImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <GiftIcon className="h-6 w-6 text-muted" strokeWidth={1.7} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {gift.itemTitle}
        </p>
        <p className="mt-1 text-xs text-muted">
          Gifted by {gift.buyerName || "Anonymous"} ·{" "}
          {formatPurchasedAt(gift.purchasedAt)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {gift.autoThankYouSent && (
            <Badge variant="muted">Auto thank-you sent ✓</Badge>
          )}
          {gift.personalThankYouSent ? (
            <Badge variant="muted">Personal thank-you sent ✓</Badge>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSendThankYou(gift)}
            >
              Send personal thank-you
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
