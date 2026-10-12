"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/account/profile/actions";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { trackEvent } from "@/lib/analytics";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const removeAccount = async () => {
    setError("");
    setPending(true);
    try {
      const result = await deleteAccountAction(confirmation);
      if (!result.success) {
        setError(result.error || "Something went wrong. Contact support if this persists.");
        return;
      }

      trackEvent("account.account_deleted");
      window.location.replace(result.redirectTo);
    } catch {
      setError("Something went wrong. Contact support if this persists.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="text"
        onClick={() => { setConfirmation(""); setError(""); setOpen(true); }}
        className="text-red-700 hover:bg-red-50"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, wishlists, occasions, saved dates, and all associated data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            <label htmlFor="delete-account-confirmation" className="text-xs font-medium text-ink">
              Type DELETE to confirm
            </label>
            <Input
              id="delete-account-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Type DELETE to confirm"
            />
            {error && <p role="alert" className="text-sm text-brand">{error}</p>}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button
              onClick={() => void removeAccount()}
              disabled={pending || confirmation !== "DELETE"}
            >
              {pending ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
