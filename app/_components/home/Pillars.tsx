"use client";

import { type MouseEvent, useRef } from "react";
import {
  type LucideIcon,
  ArrowRight,
  CalendarHeart,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import {
  cx,
  Eyebrow,
  Icon,
  Reveal,
  SectionHead,
  Wrap,
} from "@/components/ui/primitives";
import { useFinePointer, useReducedMotion } from "@/hooks/useMediaQuery";

type PillarTone = "red" | "orange" | "green";

/** Icon tile, corner blob, and cursor glare for each tone. */
const TONES: Record<PillarTone, { icon: string; blob: string; glare: string }> = {
  red: {
    icon: "bg-brand-light text-brand",
    blob: "after:bg-brand-light",
    glare: "rgba(197,4,4,0.07)",
  },
  orange: {
    icon: "bg-orange-50 text-orange-600",
    blob: "after:bg-orange-50",
    glare: "rgba(234,88,12,0.08)",
  },
  green: {
    icon: "bg-green-50 text-green-700",
    blob: "after:bg-green-50",
    glare: "rgba(21,128,61,0.07)",
  },
};

interface PillarData {
  href: string;
  icon: LucideIcon;
  tone: PillarTone;
  quote: string;
  title: string;
  body: string;
  cta: string;
}

const PILLARS: PillarData[] = [
  {
    href: "#remember",
    icon: CalendarHeart,
    tone: "red",
    quote: "Is her birthday the 14th or 16th?",
    title: "We remember",
    body: "Save a date once. We remind you in time.",
    cta: "See reminders",
  },
  {
    href: "#wishlist",
    icon: ListChecks,
    tone: "orange",
    quote: "She’ll never use it.",
    title: "They tell you",
    body: "Wishlists end the guessing.",
    cta: "See wishlists",
  },
  {
    href: "#pool",
    icon: Users,
    tone: "green",
    quote: "Everyone will do better.",
    title: "You go together",
    body: "Pool with friends. Any amount.",
    cta: "See pooling",
  },
];

/**
 * Cards lean towards the cursor and catch a soft glare where it sits.
 * Mouse only, and off when motion is reduced.
 */
function useTilt() {
  const ref = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  if (!fine || reduce) return {};

  return {
    ref,
    onMouseMove: (e: MouseEvent) => {
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (clientX - r.left) / r.width;
        const y = (clientY - r.top) / r.height;
        el.style.transform = `rotateY(${(x - 0.5) * 8}deg) rotateX(${
          (0.5 - y) * 8
        }deg) translateY(-4px)`;
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
      });
    },
    onMouseLeave: () => {
      cancelAnimationFrame(frame.current);
      if (ref.current) ref.current.style.transform = "";
    },
  };
}

function Pillar({ pillar, index }: { pillar: PillarData; index: number }) {
  const tilt = useTilt();
  const tone = TONES[pillar.tone];
  return (
    <Reveal delay={index * 0.1} className="h-full perspective-[900px]">
      <a
        href={pillar.href}
        {...tilt}
        className={cx(
          "group relative isolate flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-white px-7 pt-7.5 pb-7 outline-none transition-[transform,box-shadow,border-color] duration-250 will-change-transform hover:border-transparent hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.22)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 max-sm:px-5.5 max-sm:py-6",
          // Corner blob in the pillar's tone, swelling on hover.
          "after:absolute after:-top-10 after:-right-10 after:-z-1 after:size-32.5 after:rounded-full after:transition-transform after:duration-500 after:content-[''] hover:after:scale-[1.35]",
          tone.blob,
        )}
      >
        {/* Cursor glare; only visible while the tilt hook is feeding it. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(320px circle at var(--mx, 50%) var(--my, 0%), ${tone.glare}, transparent 70%)`,
          }}
        />

        <div className="flex items-start justify-between">
          <span
            className={cx(
              "grid size-13.5 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105",
              tone.icon,
            )}
          >
            <Icon as={pillar.icon} size={26} />
          </span>
          <span
            aria-hidden="true"
            className="font-display text-sm tracking-[0.2em] text-muted/60 tabular-nums"
          >
            0{index + 1}
          </span>
        </div>

        {/* The worry this pillar answers, set as a speech bubble. */}
        <q className="relative mt-6 self-start rounded-2xl rounded-bl-md bg-surface px-3.5 py-2 text-[13.5px] text-muted italic">
          {pillar.quote}
        </q>

        <h3 className="mt-5 text-[28px] leading-tight">{pillar.title}</h3>
        <p className="mt-2 text-[14.5px] text-muted">{pillar.body}</p>

        <span className="mt-auto inline-flex items-center gap-1.5 pt-7 text-sm font-medium text-brand">
          {pillar.cta}
          <Icon
            as={ArrowRight}
            size={16}
            className="transition-transform duration-250 group-hover:translate-x-1"
          />
        </span>
      </a>
    </Reveal>
  );
}

export default function Pillars() {
  return (
    <section className="py-24 max-sm:py-16">
      <Wrap>
        <Reveal>
          <SectionHead center className="mb-11 max-sm:mb-7">
            <Eyebrow>
              <Icon as={Sparkles} size={16} />
              Why Givtme
            </Eyebrow>
            <h2 className="text-[clamp(32px,4.4vw,54px)]">
              Gifting without the stress
            </h2>
            <p className="text-base text-muted">
              Three things usually go wrong. We fixed all three.
            </p>
          </SectionHead>
        </Reveal>

        <div className="grid grid-cols-3 gap-5 max-lg:mx-auto max-lg:max-w-xl max-lg:grid-cols-1">
          {PILLARS.map((pillar, i) => (
            <Pillar key={pillar.href} pillar={pillar} index={i} />
          ))}
        </div>
      </Wrap>
    </section>
  );
}
