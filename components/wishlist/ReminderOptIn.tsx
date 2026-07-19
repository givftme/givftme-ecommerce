"use client";

import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { getReminderScheduleCopy } from "@/lib/wishlist/display";

export function ReminderOptIn({
  wishlistId,
  inviteId,
  itemId,
  shareId,
  receiverName,
  occasionTitle,
  occasionDate,
  isAuthenticated,
}: {
  wishlistId: string;
  inviteId: string | null;
  itemId: string;
  shareId: string;
  receiverName: string;
  occasionTitle: string;
  occasionDate: string;
  isAuthenticated: boolean;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const endpoint = inviteId
    ? `/api/wishlists/${wishlistId}/invites/${inviteId}/opt-in`
    : `/api/wishlists/${wishlistId}/reminders/opt-in`;

  const optIn = async () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(endpoint, { method: "POST" });

      if (!response.ok) {
        throw new Error("Opt-in failed.");
      }

      trackEvent("reminder_optin.accepted", { item_id: itemId });
      setSaved(true);
      toast({ title: "Reminder saved.", variant: "success" });
    } catch {
      toast({
        title: "Couldn't save the reminder.",
        description: "Your gift claim is still confirmed.",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">
              Get a reminder before {receiverName}&apos;s {occasionTitle}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              {getReminderScheduleCopy(occasionTitle, occasionDate)}
            </p>
          </div>
        </div>

        <Button
          type="button"
          fullWidth
          className="mt-4"
          disabled={saving || saved}
          onClick={() => void optIn()}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved ? "Reminder saved" : "Yes, remind me"}
        </Button>
        <button
          type="button"
          className="mt-3 w-full rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          onClick={() => {
            trackEvent("reminder_optin.declined", { item_id: itemId });
            setSaved(true);
          }}
        >
          No thanks
        </button>
      </div>

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={`/w/${shareId}/success/${itemId}`}
        receiverName={receiverName}
      />
    </>
  );
}
