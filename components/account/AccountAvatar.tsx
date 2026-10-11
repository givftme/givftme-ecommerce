/* eslint-disable @next/next/no-img-element */

import { cn } from "@/lib/utils";

const FALLBACK_COLORS = [
  "bg-brand-light text-brand",
  "bg-amber-50 text-amber-800",
  "bg-emerald-50 text-emerald-800",
  "bg-sky-50 text-sky-800",
  "bg-violet-50 text-violet-800",
  "bg-orange-50 text-orange-800",
] as const;

function getColorIndex(userId: string) {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % FALLBACK_COLORS.length;
}

export function getAccountAvatarColor(userId: string) {
  return FALLBACK_COLORS[getColorIndex(userId)];
}

export function AccountAvatar({
  name,
  userId,
  avatarUrl,
  size = "md",
}: {
  name: string;
  userId: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-12 w-12 text-base",
    md: "h-16 w-16 text-xl",
    lg: "h-20 w-20 text-2xl",
  };
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold", sizes[size], avatarUrl ? "bg-surface" : getAccountAvatarColor(userId))}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}
