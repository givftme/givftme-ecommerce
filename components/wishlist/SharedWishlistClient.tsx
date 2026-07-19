"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { SharedWishlistHeader } from "@/components/wishlist/SharedWishlistHeader";
import { SharedWishlistItem } from "@/components/wishlist/SharedWishlistItem";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { daysFromToday } from "@/lib/occasion/date";
import {
  getDaysToGoCopy,
  getDisplayName,
  getOccasionLabel,
} from "@/lib/wishlist/display";
import type { SharedWishlist, WishlistItemStatus } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "available" | "claimed";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All items" },
  { value: "available", label: "Available" },
  { value: "claimed", label: "Claimed" },
];

function itemMatchesFilter(status: WishlistItemStatus, filter: Filter) {
  if (filter === "available") {
    return status === "available";
  }

  if (filter === "claimed") {
    return status === "purchased";
  }

  return true;
}

export function SharedWishlistClient({
  wishlist,
  isAuthenticated,
}: {
  wishlist: SharedWishlist;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [authOpen, setAuthOpen] = useState(false);
  const [authRedirect, setAuthRedirect] = useState(`/w/${wishlist.share_id}`);
  const [savingReminder, setSavingReminder] = useState(false);
  const receiverName = getDisplayName(wishlist.owner.full_name);
  const occasionTitle = getOccasionLabel(wishlist.occasion?.title);
  const countdown = getDaysToGoCopy(wishlist.occasion?.occasion_date);
  const canRemind = Boolean(countdown && wishlist.occasion?.occasion_date);
  const availableCount = wishlist.items.filter(
    (item) => item.status === "available"
  ).length;
  const claimedCount = wishlist.items.filter(
    (item) => item.status === "purchased"
  ).length;
  const visibleItems = useMemo(
    () => wishlist.items.filter((item) => itemMatchesFilter(item.status, filter)),
    [filter, wishlist.items]
  );

  useEffect(() => {
    trackEvent("shared_wishlist.viewed", {
      item_count: wishlist.items.length,
      available_count: availableCount,
      claimed_count: claimedCount,
      is_occasion: Boolean(wishlist.occasion),
      days_remaining: wishlist.occasion?.occasion_date
        ? daysFromToday(wishlist.occasion.occasion_date)
        : null,
    });
  }, [availableCount, claimedCount, wishlist.items.length, wishlist.occasion]);

  const handleBuy = (redirectPath: string) => {
    if (!isAuthenticated) {
      setAuthRedirect(redirectPath);
      setAuthOpen(true);
      return;
    }

    router.push(redirectPath);
  };

  const saveReminder = async () => {
    if (!isAuthenticated) {
      setAuthRedirect(`/w/${wishlist.share_id}`);
      setAuthOpen(true);
      return;
    }

    const endpoint = wishlist.invite
      ? `/api/wishlists/${wishlist.id}/invites/${wishlist.invite.id}/opt-in`
      : `/api/wishlists/${wishlist.id}/reminders/opt-in`;

    setSavingReminder(true);

    try {
      const response = await fetch(endpoint, { method: "POST" });

      if (!response.ok) {
        throw new Error("Reminder opt-in failed.");
      }

      trackEvent("reminder_optin.accepted", { item_id: null });
      toast({ title: "Reminder saved.", variant: "success" });
    } catch {
      toast({ title: "Couldn't save reminder. Try again.", variant: "danger" });
    } finally {
      setSavingReminder(false);
    }
  };

  const emptyCopy =
    wishlist.items.length === 0
      ? "This wishlist is empty - check back soon."
      : "Everything on this list has been gifted!";

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="md:hidden">
        <SharedWishlistHeader
          owner={wishlist.owner}
          occasion={wishlist.occasion}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-0 md:px-6 md:py-8 lg:px-8">
        {wishlist.viewer_is_owner && (
          <div className="mx-4 mt-4 rounded-2xl border border-stone-100 bg-white p-4 text-sm shadow-sm md:mx-0 md:mb-5 md:mt-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="font-medium text-ink">
                You&apos;re viewing your wishlist as others see it
              </p>
              <Link
                href={`/wishlists/${wishlist.id}`}
                className="font-semibold text-brand hover:text-brand-dark"
              >
                Back to managing
              </Link>
            </div>
          </div>
        )}

        <div className="md:grid md:grid-cols-[18rem_1fr] md:gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="hidden md:block">
            <div className="sticky top-6 space-y-4">
              <SharedWishlistHeader
                owner={wishlist.owner}
                occasion={wishlist.occasion}
              />
              {canRemind && (
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  disabled={savingReminder}
                  onClick={() => void saveReminder()}
                >
                  {savingReminder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  Remind me before {receiverName}&apos;s {occasionTitle}
                </Button>
              )}
            </div>
          </aside>

          <section className="min-w-0 bg-white md:rounded-2xl md:border md:border-stone-100 md:p-5 md:shadow-sm">
            <div className="overflow-x-auto border-b border-stone-100 bg-white px-4 py-3 md:rounded-t-2xl md:px-0 md:pt-0">
              <div className="flex min-w-max gap-2">
                {filters.map((item) => {
                  const count =
                    item.value === "all"
                      ? wishlist.items.length
                      : item.value === "available"
                        ? availableCount
                        : claimedCount;
                  const active = filter === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setFilter(item.value);
                        trackEvent("shared_wishlist.filter_changed", {
                          filter: item.value,
                        });
                      }}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand text-white"
                          : "bg-surface text-muted hover:bg-brand-light hover:text-brand"
                      )}
                    >
                      {item.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {visibleItems.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="mx-auto max-w-xs text-sm leading-6 text-muted">
                  {emptyCopy}
                </p>
              </div>
            ) : (
              <div className="mx-auto grid max-w-[680px] grid-cols-1 gap-3 px-4 py-5 md:grid-cols-2 md:px-0 md:py-0">
                {visibleItems.map((item, index) => (
                  <SharedWishlistItem
                    key={item.id}
                    item={item}
                    shareId={wishlist.share_id}
                    pricesVisible={wishlist.prices_visible}
                    index={index}
                    onAuthRequired={handleBuy}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {canRemind && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-100 bg-white p-4 md:hidden">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={savingReminder}
            onClick={() => void saveReminder()}
          >
            {savingReminder ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Remind me before {receiverName}&apos;s {occasionTitle}
          </Button>
        </div>
      )}

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={authRedirect}
        receiverName={receiverName}
      />
    </main>
  );
}
