"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { AddressSelector, type SavedAddress } from "@/components/checkout/AddressSelector";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { useCart } from "@/components/cart/CartContext";
import { useCartPriceRefresh } from "@/components/cart/useCartPriceRefresh";
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
  checkoutFormSchema,
  checkoutSchema,
  NIGERIAN_STATES,
  type CheckoutFormInput,
  type CheckoutFormValues,
  type PaymentPreference,
} from "@/lib/checkout/validation";
import { trackEvent } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";

interface CheckoutFormProps {
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  savedAddresses: SavedAddress[];
}

interface CheckoutResponse {
  order_id?: string;
  payment_link?: string;
  error?: string;
  unavailable_items?: Array<{ title?: string; reason?: string }>;
}

function getDefaultValues({
  initialEmail,
  initialFirstName,
  initialLastName,
}: Pick<
  CheckoutFormProps,
  "initialEmail" | "initialFirstName" | "initialLastName"
>): CheckoutFormInput {
  return {
    shipping: {
      first_name: initialFirstName,
      last_name: initialLastName,
      email: initialEmail,
      phone: "",
      street_address: "",
      apartment: "",
      city: "",
      state: "",
      postal_code: "",
      delivery_instructions: "",
    },
    preferred_payment: "card",
  };
}

export function CheckoutForm({
  initialEmail,
  initialFirstName,
  initialLastName,
  savedAddresses,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, totalPrice } = useCart();
  const { unavailableItems, priceNotice, isRefreshingPrices } =
    useCartPriceRefresh();
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasUnavailableItems = unavailableItems.length > 0;
  const form = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    mode: "onBlur",
    defaultValues: getDefaultValues({
      initialEmail,
      initialFirstName,
      initialLastName,
    }),
  });
  const preferredPayment = useWatch({
    control: form.control,
    name: "preferred_payment",
  }) as PaymentPreference | undefined;

  useEffect(() => {
    if (items.length === 0) {
      router.replace("/shop");
    }
  }, [items.length, router]);

  useEffect(() => {
    if (items.length > 0) {
      trackEvent("checkout.started", {
        item_count: items.length,
        total_value: totalPrice,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAddress = (address: SavedAddress) => {
    form.setValue(
      "shipping",
      {
        first_name: address.first_name,
        last_name: address.last_name,
        email: address.email,
        phone: address.phone,
        street_address: address.street_address,
        apartment: address.apartment,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        delivery_instructions: address.delivery_instructions,
      },
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );
  };

  const handlePaymentChange = (method: PaymentPreference) => {
    form.setValue("preferred_payment", method, {
      shouldDirty: true,
      shouldValidate: true,
    });
    trackEvent("checkout.payment_method_selected", { method });
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    setGlobalError("");

    if (items.length === 0) {
      router.replace("/shop");
      return;
    }

    if (hasUnavailableItems) {
      setGlobalError("Remove unavailable items before placing your order.");
      return;
    }

    const payload = checkoutSchema.safeParse({
      cart_items: items.map((item) => ({
        catalog_product_id: item.catalog_product_id,
        combination_key: item.combination_key,
        quantity: item.quantity,
        display_price: item.unit_price,
      })),
      shipping: values.shipping,
      preferred_payment: values.preferred_payment,
    });

    if (!payload.success) {
      setGlobalError("Check your checkout details and try again.");
      return;
    }

    setSubmitting(true);
    trackEvent("checkout.shipping_completed", {
      has_saved_address: savedAddresses.length > 0,
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.order_id) {
        if (data.unavailable_items?.length) {
          trackEvent("checkout.unavailable_items", {
            count: data.unavailable_items.length,
          });
        }

        throw new Error(data.error || "Payment couldn't start - try again.");
      }

      trackEvent("checkout.order_placed", {
        order_id: data.order_id,
        total_value: totalPrice,
        item_count: items.length,
      });

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

  return (
    <section className="bg-surface pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-ink lg:text-3xl">
          Checkout details
        </h1>

        <Form {...form}>
          <form
            id="checkout-shipping-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 grid gap-8 lg:grid-cols-3"
          >
            <fieldset
              disabled={submitting}
              className="space-y-6 lg:col-span-2 lg:col-start-1 lg:row-start-1"
            >
              <AddressSelector
                addresses={savedAddresses}
                onSelect={applyAddress}
                disabled={submitting}
              />

              <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="shipping.first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <Input autoComplete="given-name" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipping.last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <Input autoComplete="family-name" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-ink">
                      Country / Region
                    </span>
                    <Input value="Nigeria" disabled readOnly />
                  </label>

                  <FormField
                    control={form.control}
                    name="shipping.street_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street address</FormLabel>
                        <Input autoComplete="street-address" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shipping.apartment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apt, suite, unit</FormLabel>
                        <Input
                          placeholder="apartment, suite, unit, etc."
                          {...field}
                          value={field.value ?? ""}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="shipping.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City / Town</FormLabel>
                          <Input autoComplete="address-level2" {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shipping.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <select
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70"
                          >
                            <option value="" disabled>
                              Select a state
                            </option>
                            {NIGERIAN_STATES.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="shipping.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number</FormLabel>
                        <Input
                          type="tel"
                          autoComplete="tel"
                          placeholder="08012345678"
                          {...field}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shipping.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <Input type="email" autoComplete="email" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shipping.postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal code</FormLabel>
                        <Input
                          autoComplete="postal-code"
                          {...field}
                          value={field.value ?? ""}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shipping.delivery_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery instruction</FormLabel>
                        <Textarea
                          placeholder="e.g. ring the bell, leave at gate"
                          {...field}
                          value={field.value ?? ""}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </fieldset>

            <div className="lg:col-start-3 lg:row-span-2">
              <OrderSummaryPanel items={items} total={totalPrice} />
              {priceNotice ? (
                <p className="mt-3 rounded-xl bg-brand-light px-4 py-3 text-sm font-medium text-brand">
                  {priceNotice}
                </p>
              ) : null}
              {hasUnavailableItems ? (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  Remove unavailable items from your cart before checkout.
                </div>
              ) : null}
            </div>

            <div className="space-y-4 lg:col-span-2 lg:col-start-1 lg:row-start-2">
              <PaymentMethodSelector
                value={preferredPayment || "card"}
                onChange={handlePaymentChange}
                disabled={submitting}
              />

              {globalError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {globalError}
                </p>
              ) : null}

              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={
                  submitting ||
                  isRefreshingPrices ||
                  hasUnavailableItems ||
                  items.length === 0 ||
                  totalPrice <= 0
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Place order ${formatPrice(totalPrice)}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </section>
  );
}
