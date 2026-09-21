"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Loader2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PriceChangeDialog, type PriceChange } from "@/components/checkout/PriceChangeDialog";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  giftCheckoutFormSchema,
  type GiftCheckoutFormInput,
  type GiftCheckoutFormValues,
  type PaymentPreference,
} from "@/lib/checkout/validation";
import type { GiftCheckoutContext } from "@/lib/gift/types";
import { trackEvent } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";

interface GiftCheckoutResponse {
  order_id?: string;
  payment_link?: string;
  error?: string;
  price_changed?: boolean;
  price_changes?: PriceChange[];
}

function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Buying one gift from somebody's wishlist.
 *
 * Two things make this different from ordinary checkout. There is no
 * address field, because the destination is the recipient's and is held on
 * the server; and there is no cart, because a gift is one item at quantity
 * one, bound on the server to the reservation this buyer holds.
 */
export function GiftCheckoutForm({
  context,
  receiverName,
  initialEmail,
  initialFirstName,
  initialLastName,
  backHref,
}: {
  context: GiftCheckoutContext;
  receiverName: string;
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  backHref: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [paymentPreference, setPaymentPreference] =
    useState<PaymentPreference>("card");
  const [idempotencyKey] = useState(generateIdempotencyKey);
  const [priceChangeConfirmation, setPriceChangeConfirmation] = useState<{
    priceChanges: PriceChange[];
    orderId: string;
    paymentLink?: string;
  } | null>(null);

  const form = useForm<
    GiftCheckoutFormInput,
    unknown,
    GiftCheckoutFormValues
  >({
    resolver: zodResolver(giftCheckoutFormSchema),
    mode: "onBlur",
    defaultValues: {
      contact: {
        first_name: initialFirstName,
        last_name: initialLastName,
        email: initialEmail,
        phone: "",
      },
      gift_message: "",
      preferred_payment: "card",
    },
  });

  const onSubmit = async (values: GiftCheckoutFormValues) => {
    setGlobalError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // One key for this gift, held for the life of the form, so a
          // double tap or a retry after a dropped response resolves to the
          // same order rather than a second one (spec AC-31).
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          order_source: "wishlist",
          cart_items: [
            {
              catalog_product_id: context.catalog_product_id,
              combination_key: context.combination_key,
              quantity: 1,
              // Display only. The server recomputes what is charged and
              // tells us if it moved.
              display_price: context.unit_price,
            },
          ],
          contact: values.contact,
          gift_message: values.gift_message || undefined,
          preferred_payment: paymentPreference,
        }),
      });

      const data = (await response.json()) as GiftCheckoutResponse;

      if (!response.ok || !data.order_id) {
        throw new Error(data.error || "Payment couldn't start - try again.");
      }

      trackEvent("gift.order_placed", {
        order_id: data.order_id,
        item_id: context.wishlist_item_id,
      });

      if (data.price_changed && data.price_changes?.length) {
        setPriceChangeConfirmation({
          priceChanges: data.price_changes,
          orderId: data.order_id,
          paymentLink: data.payment_link,
        });
        return;
      }

      if (data.payment_link) {
        window.location.assign(data.payment_link);
        return;
      }

      router.push(`/checkout/processing?order=${data.order_id}`);
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Payment couldn't start - try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const continueToPayment = () => {
    if (!priceChangeConfirmation) {
      return;
    }

    const { orderId, paymentLink } = priceChangeConfirmation;
    setPriceChangeConfirmation(null);

    if (paymentLink) {
      window.location.assign(paymentLink);
      return;
    }

    router.push(`/checkout/processing?order=${orderId}`);
  };

  return (
    <section className="bg-surface pb-12">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <h1 className="text-2xl font-bold text-ink lg:text-3xl">
          Send this gift to {receiverName}
        </h1>

        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
            {context.product_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={context.product_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Gift className="h-7 w-7 text-stone-300" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {context.product_title}
            </p>
            <p className="mt-1 text-lg font-bold text-brand">
              {formatPrice(context.unit_price)}
            </p>
          </div>
        </div>

        {/*
          The buyer is told where the gift is going, in the only terms they
          are entitled to: a first name, a city and a state. The street,
          the apartment, the phone and any delivery notes stay on the
          server (spec AC-22).
        */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="text-sm leading-6 text-muted">
            {context.has_destination ? (
              <p>
                Going to {context.recipient_first_name} in{" "}
                {context.recipient_city}, {context.recipient_state}. The full
                delivery details are held securely and are never shown to you.
              </p>
            ) : (
              <p>
                {receiverName} hasn&apos;t added a delivery address yet. You can
                still pay now; we&apos;ll arrange delivery with them and keep
                your gift a surprise.
              </p>
            )}
          </div>
        </div>

        <Form {...form}>
          <form
            className="mt-6 space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink">
                Your details
              </h2>
              <p className="mt-1 text-sm text-muted">
                So we can send you the receipt and delivery updates.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contact.first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <Input {...field} autoComplete="given-name" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact.last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <Input {...field} autoComplete="family-name" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <Input {...field} type="email" autoComplete="email" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <Input {...field} type="tel" autoComplete="tel" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink">
                Add a note (optional)
              </h2>
              <p className="mt-1 text-sm text-muted">
                We&apos;ll include it with the gift.
              </p>
              <FormField
                control={form.control}
                name="gift_message"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel className="sr-only">Your note</FormLabel>
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={500}
                      placeholder={`Happy birthday, ${receiverName}!`}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <PaymentMethodSelector
              value={paymentPreference}
              onChange={setPaymentPreference}
            />

            {globalError && (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
              >
                {globalError}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button type="submit" size="lg" fullWidth disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Pay {formatPrice(context.unit_price)}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => router.push(backHref)}
              >
                Back to the gift
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <PriceChangeDialog
        open={Boolean(priceChangeConfirmation)}
        priceChanges={priceChangeConfirmation?.priceChanges ?? []}
        onContinue={continueToPayment}
      />
    </section>
  );
}
