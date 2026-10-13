"use client";

import { BadgeCheck, FileCheck, Headset, Palette, Route, Truck } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { Eyebrow, Icon, Reveal, SectionHead, Wrap, cx } from "@/components/ui/primitives";

const STEPS = [
  { icon: Headset, title: "Brief", detail: "Tell the Experience Centre the occasion, team and budget." },
  { icon: Palette, title: "Design", detail: "We brand the cakes, packs and cards with your logo." },
  { icon: BadgeCheck, title: "Approve", detail: "You sign off on mockups and the recipient list." },
  { icon: Truck, title: "Deliver", detail: "On the day, to desks, homes or every office." },
  { icon: FileCheck, title: "Report", detail: "Delivery photos, a summary and one invoice." },
];

/** Step circles light up in turn as the progress line reaches them. */
const STEP_DELAYS = [0, 0.2, 0.5, 0.8, 1.1];

const easing = "ease-[cubic-bezier(0.2,0.8,0.2,1)]";

export function HowItWorks() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section id="how" aria-labelledby="how-heading" className="bg-soft py-24 max-sm:py-16">
      <Wrap>
        <Reveal>
          <SectionHead center className="mb-10">
            <Eyebrow tone="brand">
              <Icon as={Route} size={16} />
              How it works
            </Eyebrow>
            <h2 id="how-heading" className="font-display text-[clamp(32px,4.4vw,54px)] leading-[1.08]">
              Brief us once. We handle the rest.
            </h2>
          </SectionHead>
        </Reveal>

        <div ref={ref} className="relative">
          {/* Track and fill run across on desktop, down the left on mobile. */}
          <span
            aria-hidden="true"
            className="absolute bg-line lg:inset-x-[5%] lg:top-6.75 lg:h-0.5 max-lg:inset-y-0 max-lg:left-6.75 max-lg:w-0.5"
          />
          <span
            aria-hidden="true"
            className={cx(
              "absolute bg-brand-gradient transition-[width,height] duration-1600 lg:top-6.75 lg:left-[5%] lg:h-0.5 max-lg:top-0 max-lg:left-6.75 max-lg:w-0.5",
              easing,
              inView ? "lg:w-[90%] max-lg:h-full" : "lg:w-0 max-lg:h-0",
            )}
          />

          <ol className="relative grid grid-cols-5 gap-4 max-lg:grid-cols-1 max-lg:gap-5.5">
          {STEPS.map(({ icon, title, detail }, i) => (
            <li
              key={title}
              className="relative flex flex-col items-start gap-2.5 max-lg:flex-row max-lg:items-center max-lg:gap-4"
            >
              <span
                style={{ transitionDelay: inView ? `${STEP_DELAYS[i]}s` : undefined }}
                className={cx(
                  "z-1 grid size-14 shrink-0 place-items-center rounded-full border-2 transition-colors duration-400",
                  inView
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-card text-brand",
                )}
              >
                <Icon as={icon} />
              </span>
              <div>
                <b className="block text-[15px] font-semibold">{title}</b>
                <span className="text-[13.5px] text-muted">{detail}</span>
              </div>
            </li>
          ))}
          </ol>
        </div>
      </Wrap>
    </section>
  );
}
