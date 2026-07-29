"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { WishlistItem } from "@/lib/wishlist/types";

gsap.registerPlugin(useGSAP);

export function ReactivationPrompt({
  occasionId,
  occasionLabel,
  items,
}: {
  occasionId: string;
  occasionLabel: string;
  items: WishlistItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialIds = useMemo(
    () => items.map((item) => item.master_item_id).filter(Boolean) as string[],
    [items]
  );
  const [selectedIds, setSelectedIds] = useState(initialIds);

  useGSAP(
    () => {
      if (!ref.current || dismissed || items.length === 0) {
        return;
      }

      gsap.from(ref.current, {
        height: 0,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      });
    },
    { scope: ref, dependencies: [dismissed, items.length] }
  );

  if (dismissed || items.length === 0) {
    return null;
  }

  const toggle = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  };

  const save = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/occasions/${occasionId}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: selectedIds }),
      });

      if (!response.ok) {
        throw new Error("Reactivate failed.");
      }

      trackEvent("occasion.reactivation_prompt.resolved", {
        items_reactivated: selectedIds.length,
      });
      toast({ title: "Main wishlist updated.", variant: "success" });
      setDismissed(true);
      router.refresh();
    } catch {
      toast({ title: "Couldn't update your wishlist. Try again.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      ref={ref}
      className="overflow-hidden rounded-2xl border border-stone-100 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-ink">
        These gifts were purchased for your {occasionLabel}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Add them back to your main wishlist for future occasions?
      </p>

      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const masterItemId = item.master_item_id;

          if (!masterItemId) {
            return null;
          }

          return (
            <label
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-stone-100 p-3"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="h-11 w-11 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">
                  <Gift className="h-5 w-5 text-stone-300" strokeWidth={1.5} />
                </div>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {item.title}
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-muted">
                Keep on my wishlist
                <input
                  type="checkbox"
                  checked={selectedIds.includes(masterItemId)}
                  onChange={() => toggle(masterItemId)}
                  className="h-5 w-5 rounded border-stone-300 accent-brand"
                />
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>
          Maybe later
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </section>
  );
}
