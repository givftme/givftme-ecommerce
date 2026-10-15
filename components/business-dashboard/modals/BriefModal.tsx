"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useBizDash, type BriefOptions } from "@/components/business-dashboard/BizDashContext";
import { Field, Modal, Select } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { OCCASIONS } from "@/lib/business-dashboard/data";
import { toIsoDate } from "@/lib/business-dashboard/utils";
import { businessBriefSchema, type BusinessBriefValues } from "@/lib/business-dashboard/validation";

const OTHER = "Something else";

/** Send a brief to the Experience Centre (a business_enquiries row). */
export function BriefModal({ options, onClose }: { options: BriefOptions; onClose: () => void }) {
  const { member, staff, today, toast } = useBizDash();
  const occasions = [...OCCASIONS.map((occasion) => occasion.key), OTHER];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessBriefValues>({
    resolver: zodResolver(businessBriefSchema),
    defaultValues: {
      occasion: options.occasion && occasions.includes(options.occasion) ? options.occasion : OTHER,
      neededBy: options.neededBy ?? "",
      heads: options.heads ?? staff.length,
      phone: "",
      notes: options.notes ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const response = await fetch("/api/business-dashboard/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast(body?.error || "Couldn't save. Please try again.");
        return;
      }
      toast("Brief sent. The Experience Centre will be in touch.");
      onClose();
    } catch {
      toast("Couldn't save. Please try again.");
    }
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
      title="Send a brief"
      description={`The Experience Centre replies to ${member.email || "you"}, usually within a working day.`}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="biz-brief-form" size="sm" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
            Send brief
          </Button>
        </>
      }
    >
      <form id="biz-brief-form" onSubmit={onSubmit} noValidate className="grid gap-4 min-[641px]:grid-cols-2">
        <Field label="Occasion" htmlFor="brief-occasion" error={errors.occasion?.message}>
          <Select id="brief-occasion" {...register("occasion")}>
            {occasions.map((occasion) => (
              <option key={occasion}>{occasion}</option>
            ))}
          </Select>
        </Field>
        <Field label="Needed by" htmlFor="brief-date" error={errors.neededBy?.message}>
          <Input id="brief-date" type="date" min={toIsoDate(today)} className="h-11" {...register("neededBy")} />
        </Field>
        <Field label="How many people" htmlFor="brief-heads" error={errors.heads ? "Enter a number of people." : undefined}>
          <Input id="brief-heads" type="number" min={0} inputMode="numeric" className="h-11" {...register("heads", { valueAsNumber: true })} />
        </Field>
        <Field label="Phone (optional)" htmlFor="brief-phone" error={errors.phone?.message}>
          <Input id="brief-phone" type="tel" autoComplete="tel" placeholder="0803 000 0000" className="h-11" {...register("phone")} />
        </Field>
        <Field label="What do you have in mind?" htmlFor="brief-notes" error={errors.notes?.message} className="min-[641px]:col-span-2">
          <Textarea
            id="brief-notes"
            className="min-h-32"
            placeholder="A launch gift for 300 clients across Lagos and Abuja, delivered the week of…"
            {...register("notes")}
          />
        </Field>
      </form>
    </Modal>
  );
}
