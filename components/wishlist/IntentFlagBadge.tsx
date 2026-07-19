"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function IntentFlagBadge({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      gsap.from(ref.current, {
        autoAlpha: 0,
        x: -10,
        duration: 0.2,
        ease: "power2.out",
      });
    },
    { scope: ref }
  );

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700",
        className
      )}
    >
      Someone is getting this
    </span>
  );
}
