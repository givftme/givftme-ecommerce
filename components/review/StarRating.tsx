"use client";

import { useRef, useState } from "react";
import { Star } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
  size = 40,
  readOnly = false,
  className,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const displayed = hovered ?? value;

  const handleClick = (star: number) => {
    if (readOnly) return;

    onChange?.(star);
    const target = starRefs.current[star - 1];

    if (target) {
      gsap.fromTo(target, { scale: 1 }, { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 });
    }
  };

  return (
    <div className={cn("flex gap-1", className)}>
      {STARS.map((star) => (
        <button
          key={star}
          ref={(el) => {
            starRefs.current[star - 1] = el;
          }}
          type="button"
          disabled={readOnly}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(null)}
          className={cn(
            "text-amber-500 transition-transform",
            !readOnly && "cursor-pointer"
          )}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
        >
          <Star
            style={{ width: size, height: size }}
            fill={star <= displayed ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
