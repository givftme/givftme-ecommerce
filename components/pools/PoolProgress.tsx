"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatPrice } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function PoolProgress({
  raised,
  target,
  contributorCount,
}: {
  raised: number;
  target: number;
  contributorCount: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.max(0, Math.round((raised / safeTarget) * 100)));
  const circumference = 2 * Math.PI * 66;
  const offset = circumference * (1 - percentage / 100);

  useGSAP(() => {
    const ring = root.current?.querySelector<SVGCircleElement>("[data-progress-ring]");
    const bar = root.current?.querySelector<HTMLElement>("[data-progress-bar]");
    if (!ring || !bar) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(ring, { strokeDashoffset: offset });
      gsap.set(bar, { scaleX: percentage / 100 });
    });
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ring, { strokeDashoffset: circumference }, {
        strokeDashoffset: offset,
        duration: 1,
        ease: "power2.out",
      });
      gsap.fromTo(bar, { scaleX: 0 }, {
        scaleX: percentage / 100,
        duration: 1,
        ease: "power2.out",
        transformOrigin: "left center",
      });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [circumference, offset, percentage] });

  return (
    <div ref={root} className="rounded-2xl bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" strokeWidth="10" className="text-brand-light" />
            <circle
              data-progress-ring
              cx="80"
              cy="80"
              r="66"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              className="text-brand"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-4xl text-ink">{percentage}%</span>
            <span className="mt-1 text-xs text-muted">funded</span>
          </div>
        </div>

        <div className="w-full flex-1 text-center sm:text-left">
          <p className="font-display text-2xl leading-tight text-ink sm:text-3xl">
            {formatPrice(raised)} <span className="text-muted">raised</span>
          </p>
          <p className="mt-1 text-sm text-muted">of {formatPrice(target)}</p>
          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-brand-light"
            role="progressbar"
            aria-label="Pool funding progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <div
              data-progress-bar
              className="h-full origin-left rounded-full bg-brand"
              style={{ transform: `scaleX(${percentage / 100})` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            {contributorCount} {contributorCount === 1 ? "person has" : "people have"} contributed
          </p>
        </div>
      </div>
    </div>
  );
}
