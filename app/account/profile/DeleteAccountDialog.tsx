"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/account/validation";
import { deleteAccountAction } from "@/app/account/profile/actions";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canConfirm = confirmation === DELETE_CONFIRMATION_TEXT;

  const close = () => {
    onOpenChange(false);
    setConfirmation("");
  };

  const handleDelete = async () => {
    if (!canConfirm || isDeleting) {
      return;
    }

    setIsDeleting(true);

    const result = await deleteAccountAction(confirmation);

    if (!result.success) {
      toast({ title: result.error, variant: "danger" });
      setIsDeleting(false);
      return;
    }

    trackEvent("account.deleted");
    router.push(result.redirectTo);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your wishlists, occasions, orders, and reviews.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <label htmlFor="delete-confirmation" className="text-xs font-medium text-ink">
            Type {DELETE_CONFIRMATION_TEXT} to confirm
          </label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={DELETE_CONFIRMATION_TEXT}
            className="mt-2"
            autoComplete="off"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="ghost" onClick={close} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Permanently delete my account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
