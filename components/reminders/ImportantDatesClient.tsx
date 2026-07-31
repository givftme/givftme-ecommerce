"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";
import { ImportantDateCard } from "@/components/reminders/ImportantDateCard";
import { ImportantDateForm } from "@/components/reminders/ImportantDateForm";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { ImportantDate } from "@/lib/important-dates/types";
import { cn } from "@/lib/utils";

function sortDates(dates: ImportantDate[]) {
  return [...dates].sort((a, b) => a.date.localeCompare(b.date));
}

export function ImportantDatesClient({ initialDates }: { initialDates: ImportantDate[] }) {
  const { toast } = useToast();
  const [dates, setDates] = useState(() => sortDates(initialDates));
  const [formOpen, setFormOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<ImportantDate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImportantDate | null>(null);

  const openAdd = () => {
    setEditingDate(null);
    setFormOpen(true);
  };

  const openEdit = (date: ImportantDate) => {
    setEditingDate(date);
    setFormOpen(true);
  };

  const upsertDate = (date: ImportantDate) => {
    setDates((current) => {
      const exists = current.some((item) => item.id === date.id);
      const next = exists
        ? current.map((item) => (item.id === date.id ? date : item))
        : [...current, date];
      return sortDates(next);
    });
  };

  const removeDate = (date: ImportantDate) => {
    setDates((current) => current.filter((item) => item.id !== date.id));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const response = await fetch(`/api/important-dates/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      trackEvent("important_date.deleted", {});
      removeDate(deleteTarget);
      toast({ title: "Date removed.", variant: "success" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Couldn't delete this date. Try again.", variant: "danger" });
    }
  };

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Important dates</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Keep important moments close so gifting never feels last-minute.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/wishlists"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View wishlists
          </Link>
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add a date
          </Button>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
        {dates.length === 0 ? (
          <div className="rounded-2xl bg-surface px-4 py-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <CalendarHeart className="h-8 w-8 text-brand" strokeWidth={1.7} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              No special dates saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              Your saved birthdays, anniversaries, and reminders will appear here.
            </p>
            <Button type="button" className="mt-5" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add your first important date
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {dates.map((date, index) => (
              <ImportantDateCard
                key={date.id}
                date={date}
                index={index}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </section>

      <ImportantDateForm
        date={editingDate}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={upsertDate}
        onDeleted={removeDate}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this date?</DialogTitle>
            <DialogDescription>
              This removes {deleteTarget?.person_name}&apos;s date and cancels any pending
              reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmDelete()}>
              Delete date
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
