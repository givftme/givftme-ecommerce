"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import type { WishlistItem } from "@/lib/wishlist/types";
import { formatPrice } from "@/lib/utils";

export function PoolCreationDialog({
  open,
  onOpenChange,
  wishlistId,
  wishlistTitle,
  receiverId,
  receiverName,
  initialItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wishlistId: string;
  wishlistTitle: string;
  receiverId: string;
  receiverName: string;
  initialItem?: WishlistItem | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const selectedItem = initialItem?.status === "available" ? initialItem : null;
  const [title, setTitle] = useState(initialItem?.title ?? `${receiverName}'s Gift Fund`);
  const [targetAmount, setTargetAmount] = useState(String(Math.max(1500, Math.round(initialItem?.price ?? 1500))));
  const [minimum, setMinimum] = useState("1500");
  const [message, setMessage] = useState("");
  const [contributorsVisible, setContributorsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTitle(initialItem?.title ?? `${receiverName}'s Gift Fund`);
    setTargetAmount(String(Math.max(1500, Math.round(initialItem?.price ?? 1500))));
    setMinimum("1500");
    setMessage("");
    setContributorsVisible(true);
    setError(null);
  }, [initialItem, open, receiverName]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wishlist_id: wishlistId,
          wishlist_item_id: selectedItem?.id,
          receiver_id: receiverId,
          title: title.trim() || undefined,
          target_amount: Number(targetAmount),
          min_contribution: Number(minimum),
          message: message.trim() || undefined,
          contributors_visible: contributorsVisible,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        pool?: { token?: string };
      } | null;
      if (!response.ok || !payload?.pool?.token) {
        throw new Error(payload?.error || "Couldn't create this pool. Try again.");
      }

      onOpenChange(false);
      router.push(`/pool/${payload.pool.token}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Couldn't create this pool. Try again.";
      setError(message);
      toast({ title: message, variant: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedTarget = Number(targetAmount);
  const parsedMinimum = Number(minimum);
  const canContinue = title.trim().length >= 3 && title.trim().length <= 100
    && Number.isInteger(parsedTarget) && parsedTarget >= 1500
    && Number.isInteger(parsedMinimum) && parsedMinimum >= 1500 && parsedMinimum <= 5000
    && message.length <= 300;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5 md:left-1/2 md:top-1/2 md:bottom-auto md:w-[calc(100%-2rem)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-6">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Create a gift pool" : "Review your pool"}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `${selectedItem ? `For ${selectedItem.title}` : `General gift fund for ${receiverName}`} · ${wishlistTitle}. Bring friends and family together to make this gift happen.`
              : "Check the details before sharing your pool."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {step === 1 ? (
            <>
              <div className="rounded-xl bg-surface px-3 py-2.5 text-sm text-muted">
                {selectedItem ? `For: ${selectedItem.title}` : `General gift fund for ${receiverName}`}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pool-title">Pool title</Label>
                <Input id="pool-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pool-target">Target amount (₦)</Label>
                  <Input id="pool-target" type="number" min={1500} step={1} value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} required />
                  {selectedItem?.price ? <p className="text-xs text-muted">Item price: {formatPrice(selectedItem.price)}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pool-minimum">Minimum contribution (₦)</Label>
                  <Input id="pool-minimum" type="number" min={1500} max={5000} step={1} value={minimum} onChange={(event) => setMinimum(event.target.value)} required />
                  <p className="text-xs text-muted">Choose ₦1,500 to ₦5,000.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pool-message">Message to contributors <span className="font-normal text-muted">(optional)</span></Label>
                <Textarea id="pool-message" value={message} maxLength={300} placeholder="Help me get this special gift!" onChange={(event) => setMessage(event.target.value)} />
                <p className="text-right text-xs text-muted">{message.length}/300</p>
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-sm text-ink">
                <input type="checkbox" checked={contributorsVisible} onChange={(event) => setContributorsVisible(event.target.checked)} className="mt-0.5 accent-brand" />
                <span>Show contributor names and amounts on the public pool page</span>
              </label>
            </>
          ) : (
            <div className="rounded-2xl border border-stone-100 bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{selectedItem ? `For: ${selectedItem.title}` : `General gift fund for ${receiverName}`}</p>
              <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">Target</dt><dd className="font-semibold text-ink">{formatPrice(parsedTarget)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Minimum contribution</dt><dd className="font-semibold text-ink">{formatPrice(parsedMinimum)}</dd></div>
                {message.trim() && <div className="border-t border-stone-200 pt-2"><dt className="text-muted">Message</dt><dd className="mt-1 italic text-ink">{message.trim()}</dd></div>}
              </dl>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-brand">{error}</p>}

          <div className="flex gap-3 pt-1">
            {step === 2 && <Button type="button" variant="ghost" fullWidth onClick={() => setStep(1)}>Back</Button>}
            <Button type="submit" fullWidth disabled={!canContinue || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 1 ? "Review pool" : isSubmitting ? "Creating…" : "Create pool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
