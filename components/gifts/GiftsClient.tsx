"use client";

import { useMemo, useState } from "react";
import { Gift as GiftIcon } from "lucide-react";
import { GiftCard } from "@/components/gifts/GiftCard";
import { PersonalThankYouSheet } from "@/components/gifts/PersonalThankYouSheet";
import { Badge } from "@/components/ui/Badge";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { GiftReceived } from "@/lib/thank-you/types";

type FilterTab = "all" | "to_thank" | "thanked";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "to_thank", label: "To thank" },
  { id: "thanked", label: "Thanked" },
];

function matchesTab(gift: GiftReceived, tab: FilterTab) {
  if (tab === "to_thank") return !gift.personalThankYouSent;
  if (tab === "thanked") return gift.personalThankYouSent;
  return true;
}

export function GiftsClient({
  initialGifts,
  defaultThankYouMessage,
}: {
  initialGifts: GiftReceived[];
  defaultThankYouMessage: string;
}) {
  const [gifts, setGifts] = useState(initialGifts);
  const [tab, setTab] = useState<FilterTab>("all");
  const [composeTarget, setComposeTarget] = useState<GiftReceived | null>(null);

  const filtered = useMemo(() => gifts.filter((gift) => matchesTab(gift, tab)), [gifts, tab]);

  const openCompose = (gift: GiftReceived) => {
    trackEvent("thank_you.personal.compose_opened", { source: gift.source });
    setComposeTarget(gift);
  };

  const markThanked = (gift: GiftReceived) => {
    setGifts((current) =>
      current.map((item) =>
        item.id === gift.id && item.source === gift.source
          ? { ...item, personalThankYouSent: true }
          : item
      )
    );
  };

  return (
    <>
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">Gifts received</h1>
          <Badge>{gifts.length}</Badge>
        </div>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Everyone who&apos;s gifted you, and a place to say thank you.
        </p>
      </header>

      <div className="mt-5 inline-flex rounded-full bg-white p-1 shadow-sm">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === option.id ? "bg-brand text-white" : "text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="mt-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white px-4 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
              <GiftIcon className="h-8 w-8 text-brand" strokeWidth={1.7} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              {gifts.length === 0 ? "No gifts yet" : "Nothing here yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              {gifts.length === 0
                ? "Share your wishlist so people can start gifting!"
                : "Try a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((gift) => (
              <GiftCard
                key={`${gift.source}-${gift.id}`}
                gift={gift}
                onSendThankYou={openCompose}
              />
            ))}
          </div>
        )}
      </section>

      <PersonalThankYouSheet
        gift={composeTarget}
        defaultMessage={defaultThankYouMessage}
        open={Boolean(composeTarget)}
        onOpenChange={(open) => {
          if (!open) setComposeTarget(null);
        }}
        onSent={markThanked}
      />
    </>
  );
}
