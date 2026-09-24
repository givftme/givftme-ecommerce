"use client";

import Image from "next/image";
import { cx } from "@/components/ui/primitives";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useMediaQuery";

/**
 * A full-bleed photo that settles out of a slight zoom the first time it scrolls
 * into view. This is the only client-side behaviour in an otherwise static
 * section, so it stays a leaf and lets its parent render on the server.
 */
export function ZoomImage({
  src,
  alt,
  sizes = "100vw",
}: {
  src: string;
  alt: string;
  sizes?: string;
}) {
  const [ref, inView] = useInView();
  const reduce = useReducedMotion();
  const settled = inView || reduce;

  return (
    <div ref={ref} className="absolute inset-0">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cx(
          "object-cover",
          !reduce &&
            "transition-transform duration-[1400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          settled ? "scale-100" : "scale-[1.08]",
        )}
      />
    </div>
  );
}
