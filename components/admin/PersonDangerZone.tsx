"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { fieldLabel } from "@/components/admin/AdminUi";
import { useAdminRequest } from "@/components/admin/useAdminRequest";
import { cn } from "@/lib/utils";

export function PersonDangerZone({ userId, name, isTeamMember }: { userId: string; name: string; isTeamMember: boolean }) {
  const router = useRouter();
  const { send, pending } = useAdminRequest();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");

  const remove = async () => {
    const ok = await send(`/api/admin/people/${userId}`, { method: "DELETE", body: { confirmation, reason } }, `${name}'s account was deleted.`);
    if (ok) {
      setOpen(false);
      router.push("/admin/people");
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <a href={`/api/admin/people/${userId}/export`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        <Download aria-hidden="true" className="h-4 w-4" /> Data export (ZIP)
      </a>
      <Button
        type="button"
        variant="text"
        size="sm"
        className="text-danger"
        disabled={isTeamMember}
        title={isTeamMember ? "Remove their team role first" : undefined}
        onClick={() => { setConfirmation(""); setReason(""); setOpen(true); }}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}&apos;s account</DialogTitle>
            <DialogDescription>
              This runs the same deletion as the customer&apos;s own Delete Account: their profile, wishlists, dates, and associated data are removed. It cannot be undone and is logged with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            <div>
              <label htmlFor="delete-reason" className={fieldLabel}>Reason</label>
              <Textarea id="delete-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="min-h-20" placeholder="e.g. Customer requested deletion by email on 12 Oct" />
            </div>
            <div>
              <label htmlFor="delete-confirm" className={fieldLabel}>Type DELETE to confirm</label>
              <Input id="delete-confirm" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={() => void remove()} disabled={pending || confirmation !== "DELETE" || reason.trim().length < 5}>
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
