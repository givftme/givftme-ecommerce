"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { GiftReceived } from "@/lib/thank-you/types";

const MAX_MESSAGE_LENGTH = 1000;

const composeSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, "Message must be under 1000 characters"),
});

type ComposeValues = z.infer<typeof composeSchema>;

function ComposeForm({
  gift,
  defaultMessage,
  onOpenChange,
  onSent,
}: {
  gift: GiftReceived;
  defaultMessage: string;
  onOpenChange: (open: boolean) => void;
  onSent: (gift: GiftReceived) => void;
}) {
  const { toast } = useToast();
  const form = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { message: defaultMessage },
  });
  const message = useWatch({ control: form.control, name: "message" }) || "";

  const send = async (values: ComposeValues) => {
    try {
      const response = await fetch(`/api/thank-you/${gift.id}/personal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: gift.source, message: values.message }),
      });
      const payload = (await response.json()) as { sent?: boolean; error?: string };

      if (!response.ok || !payload.sent) {
        throw new Error(payload.error || "Couldn't send your message. Please try again.");
      }

      trackEvent("thank_you.personal.sent", { source: gift.source });
      toast({ title: "Thank-you sent.", variant: "success" });
      onSent(gift);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Couldn't send your message. Please try again.",
        variant: "danger",
      });
    }
  };

  return (
    <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(send)}>
      <div className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-surface p-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white">
          {gift.itemImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gift.itemImageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <p className="truncate text-sm font-medium text-ink">{gift.itemTitle}</p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-ink">To: {gift.buyerName || "Anonymous"}</span>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-ink">Your personal message</span>
        <Textarea
          {...form.register("message")}
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Say thank you in your own words..."
        />
        <div className="flex items-center justify-between">
          {form.formState.errors.message ? (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.message.message}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </label>

      <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending..." : "Send thank-you"}
      </Button>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="w-full text-center text-sm font-medium text-muted hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}

export function PersonalThankYouSheet({
  gift,
  defaultMessage,
  open,
  onOpenChange,
  onSent,
}: {
  gift: GiftReceived | null;
  defaultMessage: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (gift: GiftReceived) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Send a personal thank-you</SheetTitle>
          <SheetDescription>This is sent immediately, straight to their inbox.</SheetDescription>
        </SheetHeader>

        {gift && (
          <ComposeForm
            key={gift.id}
            gift={gift}
            defaultMessage={defaultMessage}
            onOpenChange={onOpenChange}
            onSent={onSent}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
