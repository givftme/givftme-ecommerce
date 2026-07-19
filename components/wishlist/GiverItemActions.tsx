"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle, Info, Loader2, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { getSourceDomain } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

export function GiverItemActions({
  item,
  shareId,
  receiverName,
  isAuthenticated,
  externalUrl,
}: {
  item: WishlistItem;
  shareId: string;
  receiverName: string;
  isAuthenticated: boolean;
  externalUrl: string | null;
}) {
  const { toast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [flagged, setFlagged] = useState(Boolean(item.intent_flagged_by));
  const [flagging, setFlagging] = useState(false);
  const detailPath = `/w/${shareId}/item/${item.id}`;
  const confirmPath = `/w/${shareId}/confirm/${item.id}`;
  const domain = getSourceDomain(item.product_url);

  const requireAuth = () => {
    if (isAuthenticated) {
      return true;
    }

    setAuthOpen(true);
    return false;
  };

  const animateButton = () => {
    if (!buttonRef.current) {
      return;
    }

    gsap.to(buttonRef.current, {
      scale: 0.97,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
    });
  };

  const buyExternal = () => {
    if (!requireAuth() || !externalUrl) {
      return;
    }

    animateButton();
    trackEvent("purchase.external.redirect", {
      item_id: item.id,
      domain: domain || "store",
      has_affiliate: Boolean(item.affiliate_url),
    });
    trackEvent("shared_wishlist.item.buy_tapped", {
      item_id: item.id,
      origin: item.origin,
    });
    window.open(externalUrl, "_blank", "noopener,noreferrer");
    setRedirected(true);
  };

  const flagIntent = async () => {
    if (!requireAuth()) {
      return;
    }

    setFlagging(true);

    try {
      const response = await fetch(
        `/api/wishlists/items/${item.id}/flag-intent`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Intent flag failed.");
      }

      setFlagged(true);
      trackEvent("shared_wishlist.intent_flagged", { item_id: item.id });
      toast({ title: "Intent noted.", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't flag this gift. Try again.",
        variant: "danger",
      });
    } finally {
      setFlagging(false);
    }
  };

  return (
    <>
      {item.origin === "external" && domain && (
        <div className="rounded-xl bg-surface p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <p className="text-sm leading-6 text-muted">
              You&apos;ll be redirected to {domain} to complete your purchase.
              The item will be marked as claimed so no one buys it twice.
            </p>
          </div>
        </div>
      )}

      {flagged && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-700">
          Someone has indicated they&apos;re buying this. You can still buy it.
        </div>
      )}

      <div className="space-y-3">
        {item.origin === "catalog" ? (
          isAuthenticated ? (
            <Link
              href={`/checkout?item=${item.id}`}
              className={cn(buttonVariants({ fullWidth: true, size: "lg" }))}
            >
              Buy this gift
            </Link>
          ) : (
            <Button type="button" fullWidth size="lg" onClick={() => setAuthOpen(true)}>
              Buy this gift
            </Button>
          )
        ) : (
          <>
            <Button
              ref={buttonRef}
              type="button"
              fullWidth
              size="lg"
              disabled={!externalUrl}
              onClick={buyExternal}
            >
              Buy this gift
            </Button>
            {domain && (
              <p className="text-center text-xs text-muted">
                Opens {domain} in a new tab
              </p>
            )}
          </>
        )}

        {redirected && (
          <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <p className="text-sm leading-6 text-muted">
              Once you&apos;ve bought it on {domain || "the store"}, come back
              and confirm below.
            </p>
            <Link
              href={confirmPath}
              className={cn(
                buttonVariants({ fullWidth: true }),
                "mt-3"
              )}
            >
              I bought it
            </Link>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          fullWidth
          disabled={flagging || item.status !== "available"}
          onClick={() => void flagIntent()}
        >
          {flagging && <Loader2 className="h-4 w-4 animate-spin" />}
          Someone else is buying this
        </Button>

        {item.origin === "catalog" && (
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-muted">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-brand-light hover:text-brand"
            >
              <HelpCircle className="h-4 w-4" />
              Ask a Question
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-brand-light hover:text-brand"
            >
              <RotateCcw className="h-4 w-4" />
              Delivery Return
            </button>
          </div>
        )}
      </div>

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={detailPath}
        receiverName={receiverName}
      />
    </>
  );
}
