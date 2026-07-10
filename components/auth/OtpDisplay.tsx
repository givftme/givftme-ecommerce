"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function OtpDisplay({
  value,
  errorKey,
}: {
  value: string;
  errorKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<Array<HTMLDivElement | null>>([]);

  useGSAP(
    () => {
      if (!value.length) {
        return;
      }

      const box = boxRefs.current[value.length - 1];

      if (box) {
        gsap.from(box, {
          scale: 0.8,
          opacity: 0,
          duration: 0.15,
          ease: "back.out(1.7)",
        });
      }
    },
    { dependencies: [value.length], scope: containerRef }
  );

  useGSAP(
    () => {
      if (!errorKey || !containerRef.current) {
        return;
      }

      gsap.to(containerRef.current, {
        x: [-8, 8, -6, 6, -4, 4, 0] as unknown as string,
        duration: 0.4,
        ease: "power2.inOut",
      });
    },
    { dependencies: [errorKey], scope: containerRef }
  );

  return (
    <div ref={containerRef} className="flex items-center justify-between gap-2">
      {Array.from({ length: 6 }).map((_, index) => {
        const digit = value[index];

        return (
          <div
            key={index}
            ref={(node) => {
              boxRefs.current[index] = node;
            }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border text-lg font-semibold transition-colors",
              digit
                ? "border-brand bg-brand-light text-brand"
                : "border-stone-200 bg-white text-stone-300"
            )}
          >
            {digit || ""}
          </div>
        );
      })}
    </div>
  );
}
