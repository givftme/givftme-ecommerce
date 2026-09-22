"use client";

import { type MouseEvent, type PointerEvent, useRef, useState } from "react";
import {
  type LucideIcon,
  Baby,
  Gem,
  GraduationCap,
  Heart,
  MoveHorizontal,
  ArrowLeft,
  ArrowRight,
  PartyPopper,
  Plane,
  Sun,
} from "lucide-react";
import {
  Btn,
  Eyebrow,
  Icon,
  Reveal,
  SectionHead,
  Wrap,
  cx,
} from "@/components/ui/primitives";
import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import type { ProductCardData } from "@/lib/sanity/types";

interface Room {
  href: string;
  icon: LucideIcon;
  cardClass: string;
  iconClass: string;
  title: string;
  note: string;
}

const ROOMS: Room[] = [
  {
    href: "/shop",
    icon: Heart,
    cardClass: "bg-brand text-white",
    iconClass: "text-brand",
    title: "For a mum who “needs nothing”",
    note: "Thoughtful, not flashy",
  },
  {
    href: "/shop",
    icon: Sun,
    cardClass: "bg-peach",
    iconClass: "text-orange",
    title: "For a friend who’s had a hard year",
    note: "Comfort, care, rest",
  },
  {
    href: "/shop",
    icon: Plane,
    cardClass: "bg-blue-50",
    iconClass: "text-blue",
    title: "For someone who’s leaving",
    note: "Japa send-offs",
  },
  {
    href: "/occasions/graduation",
    icon: GraduationCap,
    cardClass: "bg-green-50",
    iconClass: "text-green",
    title: "For a new chapter",
    note: "Grads, new jobs, new homes",
  },
  {
    href: "/occasions/baby-shower",
    icon: Baby,
    cardClass: "bg-amber-50",
    iconClass: "text-amber-800",
    title: "For a new baby",
    note: "Naming & Omugwo",
  },
  {
    href: "/occasions/other-festivities",
    icon: PartyPopper,
    cardClass: "bg-ink text-white",
    iconClass: "text-ink",
    title: "For Detty December",
    note: "Homecoming season",
  },
];

/** Drag-to-scroll for the rooms rail, with a click guard so a drag never navigates. */
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    state.current = {
      down: true,
      startX: e.clientX,
      startLeft: ref.current.scrollLeft,
      moved: false,
    };
    setDragging(true);
  };

  const stop = () => {
    state.current.down = false;
    setDragging(false);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!state.current.down || !ref.current) return;
    const dx = e.clientX - state.current.startX;
    if (Math.abs(dx) > 4) state.current.moved = true;
    ref.current.scrollLeft = state.current.startLeft - dx;
  };

  const onClickCapture = (e: MouseEvent) => {
    if (state.current.moved) {
      e.preventDefault();
      state.current.moved = false;
    }
  };

  return {
    scroll: (direction: number) => {
      const rail = ref.current;
      if (rail)
        rail.scrollBy({
          left: direction * rail.clientWidth * 0.8,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
    },
    dragging,
    railProps: {
      ref,
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onDragStart: (e: MouseEvent) => e.preventDefault(),
      onClickCapture,
    },
  };
}

export default function Museum({ products }: { products: ProductCardData[] }) {
  const { dragging, railProps, scroll } = useDragScroll();

  return (
    <section
      id="museum"
      aria-labelledby="museum-heading"
      className="scroll-mt-24 py-16 sm:py-24"
    >
      <Wrap>
        <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <SectionHead>
            <Eyebrow tone="brand">
              <Icon as={Gem} size={16} />
              Gift Museum
            </Eyebrow>
            <h2
              id="museum-heading"
              className="font-display text-4xl leading-tight sm:text-5xl"
            >
              Mind gone blank? Start here.
            </h2>
            <p className="text-base text-muted">
              Browse by feeling, not by category.
            </p>
          </SectionHead>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-muted sm:inline-flex">
              <Icon as={MoveHorizontal} size={16} />
              Swipe or drag to explore
            </span>
            <Btn
              type="button"
              tone="line"
              aria-label="Previous gift collections"
              aria-controls="museum-rooms"
              onClick={() => scroll(-1)}
            >
              <Icon as={ArrowLeft} size={18} />
            </Btn>
            <Btn
              type="button"
              tone="line"
              aria-label="Next gift collections"
              aria-controls="museum-rooms"
              onClick={() => scroll(1)}
            >
              <Icon as={ArrowRight} size={18} />
            </Btn>
          </div>
        </Reveal>

        <div
          {...railProps}
          id="museum-rooms"
          role="region"
          aria-label="Gift collections"
          tabIndex={0}
          className={cx(
            "no-scrollbar -mx-4.5 flex gap-4 overflow-x-auto px-4.5 pt-2 pb-6 focus-visible:outline-2 focus-visible:outline-brand sm:-mx-5.5 sm:px-5.5",
            dragging ? "cursor-grabbing" : "cursor-grab snap-x snap-mandatory",
          )}
        >
          {ROOMS.map((room, i) => (
            <a
              key={i}
              href={room.href}
              draggable="false"
              className={cx(
                "flex min-h-56 w-56 shrink-0 snap-start select-none flex-col justify-between gap-5 rounded-3xl p-5 transition-transform duration-300 motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-64 sm:w-64 sm:p-6",
                room.cardClass,
              )}
            >
              <span
                className={cx(
                  "grid size-12 place-items-center rounded-2xl bg-white/75",
                  room.iconClass,
                )}
              >
                <Icon as={room.icon} />
              </span>
              <div>
                <h3 className="font-display text-2xl leading-tight">
                  {room.title}
                </h3>
                <span className="text-sm opacity-80">{room.note}</span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-2xl">A few thoughtful finds</h3>
            <Btn as="a" href="/shop" tone="line">
              Explore all gifts <Icon as={ArrowRight} size={16} />
            </Btn>
          </div>
          <CatalogProductGrid
            products={products}
            emptyMessage="New gifts are on the way. Explore the shop for more ideas."
          />
        </div>
      </Wrap>
    </section>
  );
}
