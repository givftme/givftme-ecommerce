"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WISHLIST_COVER,
  WISHLIST_COVER_KEYS,
  WISHLIST_COVERS,
  type WishlistCoverKey,
} from "@/lib/wishlist/covers";

/**
 * "Change cover" control for the wishlist cover. Saves the chosen palette key
 * through the wishlist PATCH handler, optimistically, and rolls back on error.
 */
export function WishlistCoverPicker({
  wishlistId,
  value,
  onChange,
}: {
  wishlistId: string;
  value: WishlistCoverKey | null;
  onChange: (cover: WishlistCoverKey | null) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const current = value ?? DEFAULT_WISHLIST_COVER;

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
        }
        return;
      }

      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = async (cover: WishlistCoverKey) => {
    if (cover === current) {
      setOpen(false);
      return;
    }

    const previous = value;
    onChange(cover);
    setOpen(false);

    try {
      const response = await fetch(`/api/wishlists/${wishlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_color: cover }),
      });

      if (!response.ok) {
        throw new Error("Cover update failed.");
      }

      trackEvent("wishlist.cover.changed", { cover });
    } catch {
      onChange(previous);
      toast({ title: "Couldn't change the cover. Try again.", variant: "danger" });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Change cover
      </button>

      {open && (
        <div
          id={panelId}
          role="radiogroup"
          aria-label="Cover colour"
          className="absolute right-0 top-11 z-20 w-60 rounded-2xl bg-white p-3 text-ink shadow-float"
        >
          <p className="mb-2 px-0.5 text-xs font-medium text-muted">Cover colour</p>
          <div className="grid grid-cols-4 gap-2">
            {WISHLIST_COVER_KEYS.map((cover) => {
              const selected = cover === current;

              return (
                <button
                  key={cover}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={WISHLIST_COVERS[cover].label}
                  title={WISHLIST_COVERS[cover].label}
                  onClick={() => void choose(cover)}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white text-white ring-1 ring-line transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    WISHLIST_COVERS[cover].className,
                    selected && "ring-2 ring-ink"
                  )}
                >
                  {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
