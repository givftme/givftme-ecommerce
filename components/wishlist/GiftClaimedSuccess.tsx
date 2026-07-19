"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ReminderOptIn } from "@/components/wishlist/ReminderOptIn";
import { buttonVariants } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import {
  getDaysToGoCopy,
  getOccasionLabel,
} from "@/lib/wishlist/display";
import type { SharedWishlist, WishlistItem } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function GiftClaimedSuccess({
  wishlist,
  item,
  receiverName,
  isAuthenticated,
}: {
  wishlist: SharedWishlist;
  item: WishlistItem;
  receiverName: string;
  isAuthenticated: boolean;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const occasionTitle = getOccasionLabel(wishlist.occasion?.title);
  const occasionDate = wishlist.occasion?.occasion_date || null;
  const showReminder = Boolean(occasionDate && getDaysToGoCopy(occasionDate));

  useGSAP(
    () => {
      if (!iconRef.current) {
        return;
      }

      gsap.from(iconRef.current, {
        scale: 0,
        autoAlpha: 0,
        duration: 0.5,
        ease: "back.out(2)",
      });
    },
    { scope: iconRef }
  );

  useEffect(() => {
    if (showReminder) {
      trackEvent("reminder_optin.shown", { item_id: item.id });
    }
  }, [item.id, showReminder]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <div
          ref={iconRef}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-light text-brand"
        >
          <CheckCircle className="h-10 w-10" />
        </div>

        <section>
          <h1 className="text-3xl font-bold text-ink">Gift claimed! 🎉</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            You&apos;ve claimed {item.title} for {receiverName}&apos;s{" "}
            {occasionTitle}. {receiverName} will be notified and will send you
            a thank you.
          </p>
        </section>

        {showReminder && occasionDate && (
          <ReminderOptIn
            wishlistId={wishlist.id}
            inviteId={wishlist.invite?.id || null}
            itemId={item.id}
            shareId={wishlist.share_id}
            receiverName={receiverName}
            occasionTitle={occasionTitle}
            occasionDate={occasionDate}
            isAuthenticated={isAuthenticated}
          />
        )}

        <Link
          href={`/w/${wishlist.share_id}`}
          className={cn(buttonVariants({ variant: "ghost", fullWidth: true }))}
        >
          View {receiverName}&apos;s full wishlist
        </Link>
      </div>
    </main>
  );
}
