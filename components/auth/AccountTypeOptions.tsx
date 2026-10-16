"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Gift } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buttonVariants } from "@/components/ui/Button";
import { track } from "@/lib/events/track";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type AccountType = "individual" | "business";

const INDIVIDUAL_FEATURES = [
  "Create wishlists for any occasion",
  "Share with friends and family",
  "Receive gifts people know you'll love",
];

const BUSINESS_FEATURES = [
  "Staff birthdays handled automatically",
  "Branded packaging with your logo",
  "One invoice, every delivery",
];

const card =
  "relative flex flex-col rounded-2xl border p-6 text-left transition-[box-shadow,border-color] duration-200 sm:p-7";

/**
 * The two account type cards on /get-started. Each card is a plain link, so
 * the choice works without JavaScript; with it, the card dips before the
 * client-side navigation.
 */
export function AccountTypeOptions({
  individualHref,
  businessHref,
  hint,
  className,
}: {
  individualHref: string;
  businessHref: string;
  hint: "business" | null;
  className?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const individualRef = useRef<HTMLAnchorElement>(null);
  const businessRef = useRef<HTMLAnchorElement>(null);
  const viewTracked = useRef(false);
  const navigating = useRef(false);

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    void track("get_started.viewed", { hint });
  }, [hint]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from([individualRef.current, businessRef.current], {
          y: 28,
          opacity: 0,
          duration: 0.5,
          stagger: 0.12,
          ease: "power2.out",
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef }
  );

  const choose = (event: React.MouseEvent<HTMLAnchorElement>, type: AccountType, href: string) => {
    void track(type === "individual" ? "get_started.individual_selected" : "get_started.business_selected");

    // New-tab and modified clicks keep the browser's default behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (navigating.current) return;
    navigating.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    // The page unmounts on navigation, so this tween needs no cleanup.
    gsap.to(event.currentTarget, {
      scale: 0.97,
      duration: 0.15,
      ease: "power2.out",
      onComplete: () => router.push(href),
    });
  };

  return (
    <div ref={containerRef} className={cn("grid w-full max-w-[640px] gap-4 sm:grid-cols-2", className)}>
      <Link
        ref={individualRef}
        href={individualHref}
        onClick={(event) => choose(event, "individual", individualHref)}
        className={cn(
          card,
          "border-line border-t-4 border-t-brand bg-card text-ink hover:border-brand hover:shadow-[0_8px_32px_rgba(197,4,4,0.12)] focus-visible:border-brand focus-visible:shadow-[0_8px_32px_rgba(197,4,4,0.12)]"
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-light">
          <Gift aria-hidden="true" className="size-10 text-brand" strokeWidth={1.75} />
        </span>
        <h2 className="mt-5 text-xl font-semibold">For me</h2>
        <p className="mt-1 text-sm font-medium text-brand">Personal wishlists &amp; gifting</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Create a wishlist for your birthday, wedding, or any occasion. Share it with friends and family so you
          always get gifts you actually want.
        </p>
        <ul className="mb-6 mt-5 space-y-2.5 text-sm">
          {INDIVIDUAL_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
              {feature}
            </li>
          ))}
        </ul>
        <span className={cn(buttonVariants({ fullWidth: true, size: "lg" }), "mt-auto h-12")}>
          Create personal account
        </span>
      </Link>

      <Link
        ref={businessRef}
        href={businessHref}
        onClick={(event) => choose(event, "business", businessHref)}
        className={cn(
          card,
          // ink-deep stays dark in both themes, where `ink` flips to near-white.
          "border-white/10 bg-ink-deep text-white hover:shadow-[0_8px_32px_rgba(255,255,255,0.08)] focus-visible:shadow-[0_8px_32px_rgba(255,255,255,0.08)]",
          hint === "business" && "ring-2 ring-brand"
        )}
      >
        <span className="absolute right-5 top-5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
          For teams
        </span>
        <span className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
          <Building2 aria-hidden="true" className="size-10 text-white" strokeWidth={1.75} />
        </span>
        <h2 className="mt-5 text-xl font-semibold">For my business</h2>
        <p className="mt-1 text-sm font-medium text-white/80">Corporate gifting at scale</p>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Manage birthdays, work anniversaries, and campaigns for your entire team. Branded cakes, hampers, and gift
          cards — delivered on the day.
        </p>
        <ul className="mb-6 mt-5 space-y-2.5 text-sm">
          {BUSINESS_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
              {feature}
            </li>
          ))}
        </ul>
        <span
          className={cn(
            buttonVariants({ fullWidth: true, size: "lg" }),
            "mt-auto h-12 bg-white text-ink-deep hover:bg-white/90"
          )}
        >
          Create business account
        </span>
      </Link>
    </div>
  );
}
