"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { newsletterSchema, type NewsletterInput } from "@/lib/newsletter/validation";
import { trackEvent } from "@/lib/analytics";

export function NewsletterSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: NewsletterInput) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (response.status === 409) {
        toast({ title: "You're already subscribed." });
        return;
      }

      if (!response.ok) {
        throw new Error("Could not subscribe.");
      }

      trackEvent("newsletter.subscribed");
      toast({ title: "Subscribed ✓", variant: "success" });
      reset();
    } catch {
      toast({
        title: "Couldn't subscribe. Try again.",
        variant: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-surface py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid gap-6 rounded-2xl border border-stone-100 bg-white p-6 shadow-sm md:grid-cols-2 md:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">
                Be the first to know about our discount orders
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Get early alerts when curated gift deals go live.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-2 sm:min-w-96 sm:flex-row md:justify-self-end"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <Input
                id="newsletter-email"
                type="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-brand">{errors.email.message}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
