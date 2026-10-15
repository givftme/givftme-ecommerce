"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Field, Modal, Select } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deletePerson, upsertPerson } from "@/lib/business-dashboard/actions";
import { DEPARTMENTS, RELATIONSHIPS, TIERS } from "@/lib/business-dashboard/data";
import type { BusinessPerson, PersonKind } from "@/lib/business-dashboard/types";
import { toMmdd } from "@/lib/business-dashboard/utils";
import { personSchema, type PersonValues } from "@/lib/business-dashboard/validation";

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString("en-GB", { month: "long" }),
);

/** Birthday as day + month selects; the year is never asked for. */
function BirthdayInput({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid: boolean }) {
  const [month, day] = value ? value.split("-").map(Number) : [0, 0];
  const daysInMonth = month ? new Date(2000, month, 0).getDate() : 31;
  const update = (nextMonth: number, nextDay: number) =>
    onChange(nextMonth && nextDay ? toMmdd(nextMonth, Math.min(nextDay, new Date(2000, nextMonth, 0).getDate())) : "");

  return (
    <div className="grid grid-cols-[1fr_2fr] gap-2">
      <Select aria-label="Birthday day" aria-invalid={invalid} value={day || ""} onChange={(event) => update(month, Number(event.target.value))}>
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, index) => (
          <option key={index + 1} value={index + 1}>{index + 1}</option>
        ))}
      </Select>
      <Select aria-label="Birthday month" aria-invalid={invalid} value={month || ""} onChange={(event) => update(Number(event.target.value), day || 1)}>
        <option value="">Month</option>
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>{name}</option>
        ))}
      </Select>
    </div>
  );
}

/** Add or edit one staff member or client. */
export function PersonModal({ kind, person, onClose }: { kind: PersonKind; person?: BusinessPerson; onClose: () => void }) {
  const { account, run } = useBizDash();
  const staff = kind === "staff";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: person?.name ?? "",
      bday: person?.bday ?? "",
      tier: person?.tier ?? "Standard",
      department: person?.department ?? (staff ? "Unassigned" : ""),
      role_title: person?.role_title ?? "",
      start_date: person?.start_date ?? "",
      company: person?.company ?? "",
      relationship: person?.relationship ?? "Client",
      account_owner: person?.account_owner ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await run(
      () => upsertPerson(account.id, { ...values, id: person?.id, kind }),
      person ? "Saved" : `${values.name} added`,
    );
    if (result.ok) onClose();
  });

  const remove = async () => {
    if (!person || !window.confirm(`Remove ${person.name}?`)) return;
    const result = await run(() => deletePerson(account.id, person.id), `${person.name} removed`);
    if (result.ok) onClose();
  };

  const noun = staff ? "staff member" : "client or partner";

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
      title={person ? `Edit ${person.name}` : `Add a ${noun}`}
      description={staff ? "Birthdays and work anniversaries come from here." : "We'll remind you before their birthday."}
      footer={
        <>
          {person ? (
            <Button type="button" variant="text" size="sm" className="mr-auto text-danger" onClick={remove} disabled={isSubmitting}>
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="biz-person-form" size="sm" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {person ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form id="biz-person-form" onSubmit={onSubmit} noValidate className="grid gap-4 min-[641px]:grid-cols-2">
        <Field label="Full name" htmlFor="person-name" error={errors.name ? "Add a name (2–100 characters)." : undefined} className="min-[641px]:col-span-2">
          <Input id="person-name" autoComplete="off" className="h-11" aria-invalid={Boolean(errors.name)} {...register("name")} />
        </Field>

        <Field label="Birthday" error={errors.bday ? "Choose a day and month." : undefined} hint="Day and month only.">
          <Controller
            control={control}
            name="bday"
            render={({ field }) => <BirthdayInput value={field.value} onChange={field.onChange} invalid={Boolean(errors.bday)} />}
          />
        </Field>

        <Field label="Gift tier" htmlFor="person-tier">
          <Select id="person-tier" {...register("tier")}>
            {TIERS.map((tier) => (
              <option key={tier}>{tier}</option>
            ))}
          </Select>
        </Field>

        {staff ? (
          <>
            <Field label="Department" htmlFor="person-department">
              <Select id="person-department" {...register("department")}>
                {DEPARTMENTS.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </Select>
            </Field>
            <Field label="Role" htmlFor="person-role">
              <Input id="person-role" className="h-11" placeholder="Senior Accountant" {...register("role_title")} />
            </Field>
            <Field label="Start date" htmlFor="person-start" hint="For work anniversaries (1, 3, 5, 10 years…).">
              <Input id="person-start" type="date" className="h-11" {...register("start_date")} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Company" htmlFor="person-company">
              <Input id="person-company" className="h-11" {...register("company")} />
            </Field>
            <Field label="Relationship" htmlFor="person-relationship">
              <Select id="person-relationship" {...register("relationship")}>
                {RELATIONSHIPS.map((relationship) => (
                  <option key={relationship}>{relationship}</option>
                ))}
              </Select>
            </Field>
            <Field label="Account owner" htmlFor="person-owner" hint="Who looks after this relationship.">
              <Input id="person-owner" className="h-11" {...register("account_owner")} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
