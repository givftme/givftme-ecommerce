"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  createPoolSchema,
  type CreatePoolFormValues,
  type CreatePoolInput,
} from "@/lib/pools/validation";
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
  const form = useForm<CreatePoolFormValues, unknown, CreatePoolInput>({
    resolver: zodResolver(createPoolSchema),
    mode: "onChange",
    defaultValues: {
      wishlist_id: wishlistId,
      wishlist_item_id: selectedItem?.id,
      receiver_id: receiverId,
      title: initialItem?.title ?? `${receiverName}'s Gift Fund`,
      target_amount: Math.max(1500, Math.round(initialItem?.price ?? 1500)),
      min_contribution: 1500,
      message: "",
      contributors_visible: true,
    },
  });
  const title = form.watch("title") ?? "";
  const targetAmount = form.watch("target_amount");
  const minimum = form.watch("min_contribution");
  const message = form.watch("message") ?? "";
  const error = form.formState.errors.root?.server?.message;
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    reset({
      wishlist_id: wishlistId,
      wishlist_item_id: selectedItem?.id,
      receiver_id: receiverId,
      title: initialItem?.title ?? `${receiverName}'s Gift Fund`,
      target_amount: Math.max(1500, Math.round(initialItem?.price ?? 1500)),
      min_contribution: 1500,
      message: "",
      contributors_visible: true,
    });
  }, [initialItem, open, receiverId, receiverName, reset, selectedItem?.id, wishlistId]);

  const submit = async (values: CreatePoolInput) => {
    form.clearErrors("root.server");
    if (step === 1) {
      setStep(2);
      return;
    }

    try {
      const response = await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wishlist_id: values.wishlist_id,
          wishlist_item_id: values.wishlist_item_id,
          receiver_id: values.receiver_id,
          title: values.title?.trim() || undefined,
          target_amount: values.target_amount,
          min_contribution: values.min_contribution,
          message: values.message?.trim() || undefined,
          contributors_visible: values.contributors_visible,
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
      form.setError("root.server", { type: "server", message });
      toast({ title: message, variant: "danger" });
    }
  };

  const parsedTarget = targetAmount ?? 0;
  const parsedMinimum = minimum ?? 1500;

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

        <form noValidate onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-4">
          <input type="hidden" {...form.register("wishlist_id")} />
          {selectedItem && <input type="hidden" {...form.register("wishlist_item_id")} />}
          <input type="hidden" {...form.register("receiver_id")} />
          {step === 1 ? (
            <>
              <div className="rounded-xl bg-surface px-3 py-2.5 text-sm text-muted">
                {selectedItem ? `For: ${selectedItem.title}` : `General gift fund for ${receiverName}`}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pool-title">Pool title</Label>
                <Input id="pool-title" maxLength={100} aria-invalid={Boolean(form.formState.errors.title)} {...form.register("title")} required />
                {form.formState.errors.title?.message && <p role="alert" className="text-xs text-brand">{form.formState.errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pool-target">Target amount (₦)</Label>
                  <Input id="pool-target" type="number" min={1500} step={1} aria-invalid={Boolean(form.formState.errors.target_amount)} {...form.register("target_amount", { valueAsNumber: true })} required />
                  {form.formState.errors.target_amount?.message && <p role="alert" className="text-xs text-brand">{form.formState.errors.target_amount.message}</p>}
                  {selectedItem?.price ? <p className="text-xs text-muted">Item price: {formatPrice(selectedItem.price)}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pool-minimum">Minimum contribution (₦)</Label>
                  <Input id="pool-minimum" type="number" min={1500} max={5000} step={1} aria-invalid={Boolean(form.formState.errors.min_contribution)} {...form.register("min_contribution", { valueAsNumber: true })} required />
                  {form.formState.errors.min_contribution?.message && <p role="alert" className="text-xs text-brand">{form.formState.errors.min_contribution.message}</p>}
                  <p className="text-xs text-muted">Choose ₦1,500 to ₦5,000.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pool-message">Message to contributors <span className="font-normal text-muted">(optional)</span></Label>
                <Textarea id="pool-message" maxLength={300} placeholder="Help me get this special gift!" aria-invalid={Boolean(form.formState.errors.message)} {...form.register("message")} />
                {form.formState.errors.message?.message && <p role="alert" className="text-xs text-brand">{form.formState.errors.message.message}</p>}
                <p className="text-right text-xs text-muted">{message.length}/300</p>
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-sm text-ink">
                <input type="checkbox" className="mt-0.5 accent-brand" {...form.register("contributors_visible")} />
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
            <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 1 ? "Review pool" : form.formState.isSubmitting ? "Creating…" : "Create pool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
