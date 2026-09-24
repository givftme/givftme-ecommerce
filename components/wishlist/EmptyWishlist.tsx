"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Link2, PencilLine, Store } from "lucide-react";
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
      className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-5 py-9 text-center"
    >
      <Image
        src="/images/givftme-wave.png"
        alt=""
        width={820}
        height={687}
        sizes="128px"
        className="h-auto w-28 sm:w-32"
      />
      <h2 className="mt-2 font-display text-2xl leading-tight text-ink sm:text-[28px]">
        {allGifted
          ? "Everything on your list has been gifted"
          : "Nothing on your list yet"}
      </h2>
      <p className="max-w-xs text-sm leading-6 text-muted">
        {allGifted
          ? "Add a new wish whenever something catches your eye."
          : "Start with the Gifvtme store, or save something you found elsewhere."}
      </p>

      {/* Source order is deliberate: the catalogue is the primary path, with
          the external link and manual paths kept available underneath it. */}
      <Link
        href={`/shop?wishlist=${wishlistId}`}
        className={cn(
          buttonVariants({ variant: "filled", size: "md" }),
          "mt-3 max-w-full whitespace-normal text-center shadow-soft"
        )}
      >
        <Store className="h-4 w-4 shrink-0" />
        {allGifted ? "Browse Gifvtme" : "Browse Gifvtme - add your first gift"}
      </Link>

      <div className="mt-1 flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
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
