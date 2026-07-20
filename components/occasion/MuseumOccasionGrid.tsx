"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MuseumOccasionCard } from "@/components/occasion/MuseumOccasionCard";
import type { MuseumOccasion } from "@/lib/sanity/types";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MuseumOccasionGrid({
  occasions,
}: {
  occasions: MuseumOccasion[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current!.querySelectorAll(".museum-occasion-card"), {
          autoAlpha: 0,
          y: 24,
          stagger: 0.08,
          duration: 0.35,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            once: true,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [occasions.length] }
  );

  return (
    <div ref={ref} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {occasions.map((occasion) => (
        <MuseumOccasionCard key={occasion.id} occasion={occasion} />
      ))}
    </div>
  );
}
