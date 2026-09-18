"use client";

import { useRef } from "react";
import Link from "next/link";
import { Gift, Link2, PencilLine, Store } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AddItemMode } from "@/components/wishlist/AddItemSheet";

gsap.registerPlugin(useGSAP);

export function EmptyWishlist({
  wishlistId,
  onAdd,
  allGifted = false,
}: {
  wishlistId: string;
  onAdd: (mode: AddItemMode) => void;
  allGifted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.4,
        ease: "back.out(1.5)",
      });
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface">
        <Gift className="h-10 w-10 text-stone-300" strokeWidth={1.5} />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-ink">
        {allGifted
          ? "Everything on your list has been gifted"
          : "Nothing on your list yet"}
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
        {allGifted
          ? "Add a new wish whenever something catches your eye."
          : "Start with the Gifvtme store, or save something you found elsewhere."}
      </p>

      {/* Source order is deliberate: the catalogue is the primary path, with
          the external link and manual paths kept available underneath it. */}
      <Link
        href={`/shop?wishlist=${wishlistId}`}
        className={cn(buttonVariants({ variant: "filled", size: "md" }), "mt-6")}
      >
        <Store className="h-4 w-4" />
        {allGifted ? "Browse Gifvtme" : "Browse Gifvtme - add your first gift"}
      </Link>

      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
        <Button type="button" variant="text" onClick={() => onAdd("url")}>
          <Link2 className="h-4 w-4" />
          Paste product link
        </Button>
        <Button type="button" variant="text" onClick={() => onAdd("manual")}>
          <PencilLine className="h-4 w-4" />
          Add manually
        </Button>
      </div>
    </div>
  );
}
