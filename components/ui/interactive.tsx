"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type MouseEvent,
  useRef,
} from "react";
import { useInView } from "@/hooks/useInView";
import { useFinePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import { cx, type PolymorphicProps } from "@/components/ui/primitives";

const BTN_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-transparent font-medium transition-[transform,background-color,box-shadow,border-color] duration-200 active:scale-[0.97]";

export type BtnTone = "red" | "line" | "ink";
export type BtnSize = "md" | "sm";

const BTN_TONES: Record<BtnTone, string> = {
  red: "bg-red text-white shadow-[0_10px_24px_rgba(225,29,46,0.28)] hover:bg-red-600",
  line: "border-line bg-white text-ink hover:border-ink",
  ink: "bg-ink text-white",
};

const BTN_SIZES: Record<BtnSize, string> = {
  md: "h-[50px] px-6 text-[15px]",
  sm: "h-10 px-4 text-[13.5px]",
};

/**
 * Pointer-following nudge on the primary CTAs. Mouse only — it would fight
 * with touch scrolling, and it is pointless when motion is reduced.
 */
function useMagnetic(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  if (!enabled || !fine || reduce) return {};

  return {
    ref,
    onMouseMove: (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${
        (e.clientX - r.left - r.width / 2) * 0.18
      }px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
    },
    onMouseLeave: () => {
      if (ref.current) ref.current.style.transform = "";
    },
  };
}

export function Btn<T extends ElementType = "button">({
  as,
  tone = "red",
  size = "md",
  magnetic = false,
  className,
  children,
  ...rest
}: PolymorphicProps<
  T,
  { tone?: BtnTone; size?: BtnSize; magnetic?: boolean }
>) {
  const Tag: ElementType = as ?? "button";
  const magnet = useMagnetic(magnetic);
  return (
    <Tag
      className={cx(BTN_BASE, BTN_TONES[tone], BTN_SIZES[size], className)}
      {...magnet}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Fades and lifts its children into place the first time they scroll into view.
 * Renders already-visible when the visitor asks for reduced motion.
 */
export function Reveal<T extends ElementType = "div">({
  as,
  delay = 0,
  className,
  children,
  ...rest
}: PolymorphicProps<T, { delay?: number }>) {
  const Tag: ElementType = as ?? "div";
  const [ref, inView] = useInView<HTMLElement>();
  const reduce = useReducedMotion();
  const shown = inView || reduce;

  return (
    <Tag
      ref={ref}
      style={reduce ? undefined : { transitionDelay: `${delay}s` }}
      className={cx(
        "transition-[opacity,transform] duration-[800ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        shown ? "translate-y-0 opacity-100" : "translate-y-[26px] opacity-0",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Remote product and lifestyle shots come from other origins, so any of them
 * can fail. When one does we hide it and tint its frame instead of leaving a
 * broken-image glyph. The logo opts out — it has its own wordmark fallback.
 */
export function SmartImage({
  className,
  ...rest
}: ComponentPropsWithoutRef<"img">) {
  return (
    <img
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
        e.currentTarget.parentElement?.classList.add("img-fallback");
      }}
      className={className}
      {...rest}
    />
  );
}
