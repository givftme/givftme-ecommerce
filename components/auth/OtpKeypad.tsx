"use client";

import { useRef } from "react";
import { Delete } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const rows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "backspace"],
];

export function OtpKeypad({
  onDigit,
  onBackspace,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const animatePress = (key: string) => {
    const button = buttonRefs.current[key];

    if (!button) {
      return;
    }

    gsap.to(button, {
      scale: 0.94,
      duration: 0.08,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-[260px] gap-4">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-3 gap-4">
          {row.map((key) => {
            if (!key) {
              return <span key="empty" />;
            }

            const isBackspace = key === "backspace";

            return (
              <button
                key={key}
                ref={(node) => {
                  buttonRefs.current[key] = node;
                }}
                type="button"
                disabled={disabled}
                aria-label={isBackspace ? "Remove last digit" : `Enter ${key}`}
                onClick={() => {
                  animatePress(key);
                  if (isBackspace) {
                    onBackspace();
                    return;
                  }

                  onDigit(key);
                }}
                className={cn(
                  "flex h-16 min-h-16 items-center justify-center rounded-full bg-surface text-xl font-semibold text-brand transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60",
                  isBackspace && "text-brand"
                )}
              >
                {isBackspace ? <Delete className="h-5 w-5" /> : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
