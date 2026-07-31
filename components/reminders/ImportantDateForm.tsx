"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { OccasionTypeSelector } from "@/components/occasion/OccasionTypeSelector";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { ImportantDate } from "@/lib/important-dates/types";
import {
  importantDateSchema,
  type ImportantDateFormValues,
  type ImportantDateInput,
} from "@/lib/important-dates/validation";
import type { OccasionType } from "@/lib/occasion/types";

const RECURRING_BY_DEFAULT: OccasionType[] = ["birthday", "anniversary"];

function ImportantDateFormBody({
  date,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  date: ImportantDate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (date: ImportantDate) => void;
  onDeleted: (date: ImportantDate) => void;
}) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEditing = Boolean(date);
  const form = useForm<ImportantDateFormValues, unknown, ImportantDateInput>({
    resolver: zodResolver(importantDateSchema),
    defaultValues: {
      person_name: date?.person_name || "",
      occasion_type: date?.occasion_type || "birthday",
      date: date?.date || "",
      is_recurring: date?.is_recurring ?? true,
      linked_wishlist_url: "",
    },
  });

  const selectedType = useWatch({ control: form.control, name: "occasion_type" }) as
    | OccasionType
    | undefined;
  const isRecurring = Boolean(useWatch({ control: form.control, name: "is_recurring" }));

  useEffect(() => {
    if (isEditing || !selectedType || form.formState.dirtyFields.is_recurring) {
      return;
    }

    form.setValue("is_recurring", RECURRING_BY_DEFAULT.includes(selectedType));
  }, [form, isEditing, selectedType]);

  const save = async (values: ImportantDateInput) => {
    try {
      const response = await fetch(
        isEditing ? `/api/important-dates/${date!.id}` : "/api/important-dates",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      const payload = (await response.json()) as { date?: ImportantDate; error?: string };

      if (!response.ok || !payload.date) {
        throw new Error(payload.error || "Couldn't save this date.");
      }

      onSaved(payload.date);
      trackEvent(isEditing ? "important_date.edited" : "important_date.created", {
        occasion_type: payload.date.occasion_type,
        is_recurring: payload.date.is_recurring,
      });
      toast({ title: isEditing ? "Date updated." : "Date saved.", variant: "success" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Couldn't save this date.",
        variant: "danger",
      });
    }
  };

  const deleteDate = async () => {
    if (!date) {
      return;
    }

    try {
      const response = await fetch(`/api/important-dates/${date.id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      trackEvent("important_date.deleted", {});
      onDeleted(date);
      toast({ title: "Date removed.", variant: "success" });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast({ title: "Couldn't delete this date. Try again.", variant: "danger" });
    }
  };

  return (
    <>
      <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(save)}>
        <OccasionTypeSelector
          value={selectedType}
          onChange={(value) =>
            form.setValue("occasion_type", value, { shouldDirty: true, shouldValidate: true })
          }
        />

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Person&apos;s name</span>
          <Input {...form.register("person_name")} placeholder="Mum" maxLength={100} />
          {form.formState.errors.person_name && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.person_name.message}
            </span>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">When is it?</span>
          <Input type="date" {...form.register("date")} />
          {form.formState.errors.date && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.date.message}
            </span>
          )}
        </label>

        <div className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Recurs annually</p>
            <p className="text-xs text-muted">We&apos;ll remind you again next year.</p>
          </div>
          <Switch
            checked={isRecurring}
            onCheckedChange={(checked) =>
              form.setValue("is_recurring", checked, { shouldDirty: true })
            }
          />
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Their wishlist link</span>
          <Input
            {...form.register("linked_wishlist_url")}
            placeholder="Optional — paste their Gifvtme wishlist link"
          />
          {form.formState.errors.linked_wishlist_url && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.linked_wishlist_url.message}
            </span>
          )}
        </label>

        <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save date"}
        </Button>

        {isEditing && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full text-center text-sm font-medium text-red-600 hover:text-red-700"
          >
            Delete date
          </button>
        )}
      </form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this date?</DialogTitle>
            <DialogDescription>
              This removes {date?.person_name}&apos;s date and cancels any pending reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void deleteDate()}>
              Delete date
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ImportantDateForm({
  date,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  date: ImportantDate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (date: ImportantDate) => void;
  onDeleted: (date: ImportantDate) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{date ? "Edit date" : "Add a date"}</SheetTitle>
          <SheetDescription>
            We&apos;ll email you 14 and 3 days before it arrives.
          </SheetDescription>
        </SheetHeader>

        <ImportantDateFormBody
          key={date?.id || "new"}
          date={date}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </SheetContent>
    </Sheet>
  );
}
