"use client";

import { useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { fieldLabel, selectClass } from "@/components/admin/AdminUi";
import { useAdminRequest } from "@/components/admin/useAdminRequest";
import { ENQUIRY_STATUSES } from "@/lib/admin/validation";

export function ReviewDeleteButton({ reviewId, summary }: { reviewId: string; summary: string }) {
  const { send, pending } = useAdminRequest();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="text" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>{summary}. It disappears from the product page straight away and can&apos;t be restored.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={async () => {
                if (await send(`/api/admin/reviews/${reviewId}`, { method: "DELETE" }, "Review deleted.")) setOpen(false);
              }}
            >
              {pending ? "Deleting…" : "Delete review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReminderFailureActions({ reminderId }: { reminderId: string }) {
  const { send, pending } = useAdminRequest();
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" size="sm" variant="ghost" disabled={pending}
        onClick={() => void send(`/api/admin/reminders/${reminderId}/retry`, { method: "PATCH" }, "Queued for the next reminder run.")}>
        <RotateCcw aria-hidden="true" className="h-4 w-4" /> Retry
      </Button>
      <Button type="button" size="sm" variant="text" disabled={pending}
        onClick={() => void send(`/api/admin/reminders/${reminderId}/dismiss`, { method: "PATCH" }, "Reminder dismissed.")}>
        <X aria-hidden="true" className="h-4 w-4" /> Mark dismissed
      </Button>
    </div>
  );
}

export function EnquiryControls({
  enquiryId,
  status,
  assignedTo,
  notes,
  team,
}: {
  enquiryId: string;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  team: { id: string; name: string }[];
}) {
  const { send, pending } = useAdminRequest();
  const [draft, setDraft] = useState(notes ?? "");
  const url = `/api/admin/enquiries/${enquiryId}`;
  const dirty = draft.trim() !== (notes ?? "").trim();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${enquiryId}-status`} className={fieldLabel}>Status</label>
        <select
          id={`${enquiryId}-status`}
          defaultValue={status}
          disabled={pending}
          onChange={(event) => void send(url, { method: "PATCH", body: { status: event.target.value } }, "Status updated.")}
          className={selectClass}
        >
          {ENQUIRY_STATUSES.map((value) => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${enquiryId}-assignee`} className={fieldLabel}>Assigned to</label>
        <select
          id={`${enquiryId}-assignee`}
          defaultValue={assignedTo ?? ""}
          disabled={pending}
          onChange={(event) => void send(url, { method: "PATCH", body: { assigned_to: event.target.value || null } }, "Assignment updated.")}
          className={selectClass}
        >
          <option value="">Unassigned</option>
          {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${enquiryId}-notes`} className={fieldLabel}>Team notes</label>
        <Textarea
          id={`${enquiryId}-notes`}
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-20"
          placeholder="Call notes, next steps…"
        />
        {dirty ? (
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" disabled={pending}
              onClick={() => void send(url, { method: "PATCH", body: { notes: draft.trim() || null } }, "Notes saved.")}>
              {pending ? "Saving…" : "Save notes"}
            </Button>
            <Button type="button" size="sm" variant="text" onClick={() => setDraft(notes ?? "")}>Discard</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
