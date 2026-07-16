"use client";

import { useRef } from "react";
import { Gift } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/Button";

gsap.registerPlugin(useGSAP);

export function EmptyWishlist({
  onAdd,
  allGifted = false,
}: {
  onAdd: () => void;
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
    <div ref={ref} className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface">
        <Gift className="h-10 w-10 text-stone-300" strokeWidth={1.5} />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-ink">
        {allGifted ? "Everything on your list has been gifted" : "Nothing on your list yet"}
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
        {allGifted
          ? "Add a new wish whenever something catches your eye."
          : "Add things you'd love to receive from any website or the Gifvtme store."}
      </p>
      <Button type="button" onClick={onAdd} className="mt-6">
        Add your first wish
      </Button>
    </div>
  );
}
