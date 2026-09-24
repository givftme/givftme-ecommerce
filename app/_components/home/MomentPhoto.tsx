"use client";

import Image from "next/image";
import { type LucideIcon, Camera, Truck } from "lucide-react";
import { Icon, cx } from "@/components/ui/primitives";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useMediaQuery";

const NOTE_BASE =
  "absolute flex max-w-[250px] items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-3 text-[13px] leading-[1.35] text-ink shadow-float max-sm:max-w-[200px] max-sm:px-3 max-sm:py-2.5 max-sm:text-xs";

interface Note {
  icon: LucideIcon;
  tone: string;
  title: string;
  body: string;
  position: string;
  /** Seconds, so the second note lands after the first has settled. */
  delay: number;
}

const NOTES: Note[] = [
  {
    icon: Truck,
    tone: "bg-green-50 text-green",
    title: "Delivered on the day",
    body: "10:42 am · Surulere",
    position: "top-4 left-4 max-sm:top-2.5 max-sm:left-2.5",
    delay: 0.3,
  },
  {
    icon: Camera,
    tone: "bg-red-50 text-red",
    title: "It’s with her.",
    body: "Here’s the photo from the door.",
    position: "right-4 bottom-4 max-sm:right-2.5 max-sm:bottom-2.5",
    delay: 0.8,
  },
];

/** The delivery photo, with its two notes drifting in one after the other. */
export function MomentPhoto() {
  const [ref, inView] = useInView();
  const reduce = useReducedMotion();
  const shown = inView || reduce;

  return (
    <div
      ref={ref}
      className="relative aspect-[4/4.2] overflow-hidden rounded-card-xl bg-peach max-sm:aspect-[4/4.8]"
    >
      <Image
        src="/images/hero-carousel-image-02.png"
        alt="A family embracing warmly in their kitchen"
        fill
        sizes="(min-width: 1024px) 640px, 100vw"
        className="object-cover"
      />
      {NOTES.map(({ icon, tone, title, body, position, delay }) => (
        <div
          key={title}
          style={reduce ? undefined : { transitionDelay: `${delay}s` }}
          className={cx(
            NOTE_BASE,
            position,
            !reduce &&
              "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <span
            className={cx(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              tone,
            )}
          >
            <Icon as={icon} />
          </span>
          <span>
            <b className="block font-semibold">{title}</b>
            {body}
          </span>
        </div>
      ))}
    </div>
  );
}
