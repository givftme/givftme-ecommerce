import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Hook- and handler-driven primitives live in a client module; everything
// here stays server-renderable so server components can pass icon components.
export {
  Btn,
  Reveal,
  SmartImage,
  type BtnSize,
  type BtnTone,
} from "@/components/ui/interactive";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/** Props for a component that renders as the `as` element and forwards the rest to it. */
export type PolymorphicProps<T extends ElementType, P = object> = P & {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<
    ComponentPropsWithoutRef<T>,
    keyof P | "as" | "className" | "children"
  >;

/** The 1180px page gutter every section sits inside. */
export function Wrap<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      className={cx(
        "mx-auto w-full max-w-295 px-5.5 max-sm:px-4.5",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Lucide icons at the page's shared stroke weight, never shrinking in a flex row. */
export function Icon({
  as: Glyph,
  size = 20,
  className,
}: {
  as: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.9}
      className={cx("shrink-0", className)}
      aria-hidden="true"
    />
  );
}

export type PillTone = "brand" | "red" | "orange" | "green" | "blue";

const PILL_TONES: Record<PillTone, string> = {
  brand: "bg-brand text-white",
  red: "bg-red text-white",
  orange: "bg-[#fff1e4] text-[#c4520a]",
  green: "bg-green-50 text-green",
  blue: "bg-blue-50 text-blue",
};

export function Pill({
  tone = "red",
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"span"> & { tone?: PillTone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        PILL_TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

interface SlotProps {
  className?: string;
  children?: ReactNode;
}

export function Eyebrow({ className, children, tone = "red" }: SlotProps & { tone?: "red" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-[13.5px] font-medium",
        tone === "brand" ? "text-brand" : "text-red",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ className, children }: SlotProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-[7px] text-[13px] font-medium text-red-600",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section intro: eyebrow, heading, one line of support. */
export function SectionHead({
  center = false,
  className,
  children,
}: SlotProps & { center?: boolean }) {
  return (
    <div
      className={cx(
        "flex max-w-[640px] flex-col gap-3",
        center && "mx-auto items-center text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
