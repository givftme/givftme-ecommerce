"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CollectionCard } from "@/components/collection/CollectionCard";
import type { MuseumCollection } from "@/lib/sanity/types";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function CollectionGrid({
  collections,
}: {
  collections: MuseumCollection[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) {
        return;
      }

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current!.querySelectorAll(".collection-card"), {
          autoAlpha: 0,
          y: 30,
          stagger: 0.1,
          duration: 0.4,
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
    { scope: ref, dependencies: [collections.length] }
  );

  return (
    <div ref={ref} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}
