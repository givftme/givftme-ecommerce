"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  getAvatarColorClass,
  getDaysToGoCopy,
  getDisplayName,
  getInitials,
} from "@/lib/wishlist/display";
import type { SharedWishlistOccasion, SharedWishlistOwner } from "@/lib/wishlist/types";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const occasionEmoji: Record<string, string> = {
  birthday: "🎂",
  wedding: "💍",
  anniversary: "🥂",
  graduation: "🎓",
  baby_shower: "🍼",
};

function Avatar({ owner, size = "lg" }: { owner: SharedWishlistOwner; size?: "sm" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-12 w-12 text-sm";

  if (owner.avatar_url) {
    return (
      <img
        src={owner.avatar_url}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", sizeClass)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        getAvatarColorClass(owner.id),
        sizeClass
      )}
    >
      {getInitials(owner.full_name)}
    </div>
  );
}

export function ReceiverAvatar({
  owner,
  size = "lg",
}: {
  owner: SharedWishlistOwner;
  size?: "sm" | "lg";
}) {
  return <Avatar owner={owner} size={size} />;
}

export function SharedWishlistHeader({
  owner,
  occasion,
}: {
  owner: SharedWishlistOwner;
  occasion: SharedWishlistOccasion | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const countdown = getDaysToGoCopy(occasion?.occasion_date);
  const emoji = occasion?.occasion_type
    ? occasionEmoji[occasion.occasion_type] || "🎁"
    : null;

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        autoAlpha: 0,
        y: -20,
        duration: 0.4,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <header ref={ref} className="bg-brand px-4 pb-6 pt-8 text-white md:rounded-2xl md:p-6">
      <div className="flex items-center gap-3">
        <ReceiverAvatar owner={owner} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/70">Wishlist by</p>
          <h1 className="truncate text-xl font-bold">
            {getDisplayName(owner.full_name)}
          </h1>
        </div>
      </div>

      {occasion && (
        <div className="mt-5 space-y-1">
          <p className="text-sm font-semibold">
            {occasion.title} {emoji}
          </p>
          {countdown && <p className="text-sm text-white">{countdown}</p>}
        </div>
      )}
    </header>
  );
}
