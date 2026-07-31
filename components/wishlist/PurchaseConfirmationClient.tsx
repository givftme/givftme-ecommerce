"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import gsap from "gsap";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { getSourceDomain } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import { cn, formatPrice } from "@/lib/utils";

export function PurchaseConfirmationClient({
  item,
  shareId,
  receiverName,
  pricesVisible,
  isAuthenticated,
}: {
  item: WishlistItem;
  shareId: string;
  receiverName: string;
  pricesVisible: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [raceMessage, setRaceMessage] = useState("");
  const domain = getSourceDomain(item.product_url) || "the store";

  useEffect(() => {
    trackEvent("purchase.external.confirm_screen_viewed", { item_id: item.id });
  }, [item.id]);

  const confirm = async () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }

    setConfirming(true);
    gsap.to(buttonRef.current, {
      scale: 0.97,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
    });

    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlist_item_id: item.id }),
      });
      const payload = (await response.json()) as { error?: string };

      if (response.status === 409) {
        trackEvent("purchase.external.race_condition", { item_id: item.id });
        setRaceMessage(
          payload.error || "Someone just claimed this - they got there first!"
        );
        window.setTimeout(() => router.push(`/w/${shareId}`), 1800);
        return;
      }

      if (!response.ok) {
        toast({
          title: payload.error || "Couldn't confirm. Try again.",
          variant: "danger",
        });
        setConfirming(false);
        return;
      }

      trackEvent("purchase.external.confirmed", { item_id: item.id });
      router.push(`/w/${shareId}/success/${item.id}`);
      router.refresh();
    } catch {
      toast({ title: "Couldn't confirm. Try again.", variant: "danger" });
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                className="h-14 w-14 rounded-xl object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-surface" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-2 text-sm font-semibold text-ink">
                {item.title}
              </h1>
              <p className="mt-1 text-xs text-muted">From {domain}</p>
              {pricesVisible && item.price != null && item.price > 0 && (
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatPrice(item.price)}
                </p>
              )}
            </div>
          </div>
          <span className="mt-3 inline-flex rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">
            From {receiverName}&apos;s wishlist
          </span>
        </section>

        <section className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-ink">
            Did you complete your purchase on {domain}?
          </h2>
          <p className="text-sm leading-6 text-muted">
            Confirming lets {receiverName} know their gift is on the way, and
            stops others from buying the same thing.
          </p>
        </section>

        <div className="rounded-xl bg-surface p-4 text-sm leading-6 text-muted">
          Your payment details stay on {domain} - Gifvtme only records that this
          item has been claimed.
        </div>

        {raceMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700">
            {raceMessage}
          </div>
        )}

        <div className="space-y-3">
          <Button
            ref={buttonRef}
            type="button"
            fullWidth
            size="lg"
            disabled={confirming}
            onClick={() => void confirm()}
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirming ? "Confirming..." : "Yes, I bought it"}
          </Button>
          <Link
            href={`/w/${shareId}`}
            onClick={() =>
              trackEvent("purchase.external.declined", { item_id: item.id })
            }
            className={cn(buttonVariants({ variant: "ghost", fullWidth: true }))}
          >
            No, I changed my mind
          </Link>
        </div>
      </div>

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={`/w/${shareId}/confirm/${item.id}`}
        receiverName={receiverName}
      />
    </>
  );
}
