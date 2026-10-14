"use client";

import { type BaseSyntheticEvent, type ComponentProps, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormMessage, useFormField } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Btn, Icon, cx } from "@/components/ui/primitives";
import { useFeedback } from "@/hooks/useFeedback";
import {
  BUSINESS_OCCASIONS,
  BUSINESS_TEAM_SIZES,
  type BusinessEnquiryValues,
  businessEnquirySchema,
} from "@/lib/business/validation";
import { cn } from "@/lib/utils";
import { useBusiness } from "@/app/business/_components/BusinessContext";
import { CONTACT } from "@/app/business/_components/content";

const DEFAULTS: BusinessEnquiryValues = {
  company: "",
  name: "",
  email: "",
  phone: "",
  occasions: [],
  teamSize: "21–100",
  neededBy: "",
  notes: "",
};

// 16px on phones so focusing a field doesn't zoom the page.
const controlClass = "h-11.5 border-[1.5px] px-3 text-base sm:text-sm";

/** Wires a field's id and error state to its FormLabel and FormMessage. */
function useControlProps() {
  const { error, formItemId, formMessageId } = useFormField();
  return {
    id: formItemId,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? formMessageId : undefined,
  };
}

function TextControl(props: ComponentProps<typeof Input>) {
  return <Input {...useControlProps()} {...props} className={cn(controlClass, props.className)} />;
}

interface Sent {
  firstName: string;
  reference: string;
  summary: string[];
}

export function EnquiryForm() {
  const { brief, brandColor } = useBusiness();
  const { burst } = useFeedback();
  const [sent, setSent] = useState<Sent | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const form = useForm<BusinessEnquiryValues>({
    resolver: zodResolver(businessEnquirySchema),
    defaultValues: DEFAULTS,
  });

  // Section CTAs add their occasion and context to whatever is already chosen.
  useEffect(() => {
    if (!brief) return;
    if (brief.occasions?.length) {
      const chosen = new Set([...form.getValues("occasions"), ...brief.occasions]);
      form.setValue("occasions", [...chosen]);
    }
    if (brief.note) form.setValue("notes", brief.note);
    if (brief.teamSize) form.setValue("teamSize", brief.teamSize);
  }, [brief, form]);

  const onSubmit = async (values: BusinessEnquiryValues, event?: BaseSyntheticEvent) => {
    // Captured now: the form unmounts once the thank-you replaces it.
    const formElement = event?.target instanceof Element ? event.target : null;
    setSendError(null);
    const reference = `GXC-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    if (CONTACT.enquiryEndpoint) {
      try {
        const response = await fetch(CONTACT.enquiryEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ref: reference,
            ...values,
            brandColour: brandColor,
            source: "givftme-business-page",
          }),
        });
        if (!response.ok) throw new Error(`Enquiry endpoint returned ${response.status}`);
      } catch {
        setSendError("We couldn’t send that. Try again, or reach us on WhatsApp.");
        return;
      }
    }

    const summary = [`Company: ${values.company}`, `Team size: ${values.teamSize}`];
    if (values.occasions.length) summary.push(`Planning: ${values.occasions.join(", ")}`);
    if (values.neededBy) {
      const date = new Date(`${values.neededBy}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      summary.push(`Needed by: ${date}`);
    }
    burst(formElement, 80);
    setSent({ firstName: values.name.split(/\s+/)[0], reference, summary });
  };

  const startOver = () => {
    form.reset(DEFAULTS);
    setSent(null);
  };

  return (
    <div
      aria-live="polite"
      className="flex min-w-0 flex-col gap-3 rounded-card-lg bg-card p-6 text-foreground max-sm:p-4"
    >
      {sent ? (
        <div className="flex animate-slide-in flex-col items-start gap-3.5">
          <span className="grid size-14 place-items-center rounded-full bg-success/10 text-success">
            <Icon as={Check} size={26} />
          </span>
          <h3 className="font-display text-[28px] leading-[1.08]">
            Thanks, {sent.firstName} — we’re on it.
          </h3>
          <span className="rounded-[10px] bg-soft px-3 py-2 text-[13px]">
            Your reference: {sent.reference}
          </span>
          <ul className="list-disc pl-4.5 text-[13.5px] text-muted">
            {sent.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Btn type="button" tone="line" size="sm" onClick={startOver}>
            Send another brief
          </Btn>
        </div>
      ) : (
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Company</FormLabel>
                    <TextControl autoComplete="organization" placeholder="Company name" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Your name</FormLabel>
                    <TextControl autoComplete="name" placeholder="Full name" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Work email</FormLabel>
                    <TextControl type="email" autoComplete="email" placeholder="you@company.com" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Phone / WhatsApp</FormLabel>
                    <TextControl type="tel" autoComplete="tel" placeholder="+234" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="occasions"
              render={({ field }) => (
                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 text-xs font-medium text-ink">What are you planning?</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {BUSINESS_OCCASIONS.map((occasion) => {
                      const on = field.value.includes(occasion);
                      return (
                        <button
                          key={occasion}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            field.onChange(
                              on
                                ? field.value.filter((value) => value !== occasion)
                                : [...field.value, occasion],
                            )
                          }
                          className={cx(
                            "h-8.5 rounded-full border-[1.5px] px-3 text-[12.5px] font-medium transition-colors",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-line bg-card text-foreground",
                          )}
                        >
                          {occasion}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            />

            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <FormField
                control={form.control}
                name="teamSize"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Team size</FormLabel>
                    <TeamSizeSelect {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="neededBy"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Needed by</FormLabel>
                    <TextControl type="date" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Anything else?</FormLabel>
                  <NotesControl placeholder="Brand colours, locations, budget…" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />

            {sendError && (
              <p role="alert" className="text-[13px] text-danger">
                {sendError}
              </p>
            )}

            <Btn type="submit" tone="brand" disabled={form.formState.isSubmitting} className="disabled:opacity-70">
              <Icon as={Send} size={16} />
              {form.formState.isSubmitting ? "Sending…" : "Send to the Experience Centre"}
            </Btn>
          </form>
        </Form>
      )}
    </div>
  );
}

function TeamSizeSelect(props: ComponentProps<"select">) {
  return (
    <select
      {...useControlProps()}
      {...props}
      className={cn(
        "w-full rounded-xl border-line bg-card pr-9 text-ink outline-none select-caret focus:border-brand focus:ring-2 focus:ring-brand/20",
        controlClass,
      )}
    >
      {BUSINESS_TEAM_SIZES.map((size) => (
        <option key={size}>{size}</option>
      ))}
    </select>
  );
}

function NotesControl(props: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      {...useControlProps()}
      {...props}
      className="min-h-22 resize-y border-[1.5px] px-3 py-2.5 text-base sm:text-sm"
    />
  );
}
