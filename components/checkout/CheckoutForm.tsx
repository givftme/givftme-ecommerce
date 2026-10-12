"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { AddressSelector, type SavedAddress } from "@/components/checkout/AddressSelector";
import { AddressForm, type AddressFieldName } from "@/components/address/AddressForm";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PriceChangeDialog, type PriceChange } from "@/components/checkout/PriceChangeDialog";
import { useCart, type CartItem } from "@/components/cart/CartContext";
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
import {
  checkoutFormSchema,
  checkoutSchema,
  type CheckoutFormInput,
  type CheckoutFormValues,
  type CheckoutShippingValues,
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
  price_changed?: boolean;
  price_changes?: PriceChange[];
}

function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Same cart + shipping resubmitted (e.g. a network retry) reuses one key so
// /api/checkout can dedupe it; a genuinely different cart OR a shipping edit
// (address/phone/name/etc. correction before resubmitting) gets a fresh one
// — otherwise a stale key would make the server replay the *original*
// order's shipping details instead of the corrected ones. `shipping` here is
// the Zod-parsed, already-normalized value (trimmed, lowercased email, etc.)
// so equivalent input never produces spurious signature churn.
//
// preferred_payment is deliberately NOT part of this signature. Unlike
// shipping, it isn't stored on the order at all — /api/checkout always
// forwards whichever preferred_payment came with the *current* request into
// Flutterwave initiation, even on an idempotent replay, so it can never go
// stale. Including it here would do the opposite of what we want: toggling
// payment method between submissions would mint a new key, miss the
// idempotency lookup, and create a duplicate order for the same cart.
function getCheckoutSignature(
  items: CartItem[],
  shipping: CheckoutShippingValues
) {
  const cartPart = items
    .map((item) => `${item.catalog_product_id}:${item.combination_key ?? ""}:${item.quantity}`)
    .join(",");
  const shippingPart = [
    shipping.first_name,
    shipping.last_name,
    shipping.email,
    shipping.phone,
    shipping.street_address,
    shipping.apartment ?? "",
    shipping.city,
    shipping.state,
    shipping.postal_code ?? "",
    shipping.delivery_instructions ?? "",
  ].join(":");

  return `${cartPart}|${shippingPart}`;
}

function getDefaultValues({
  initialEmail,
  initialFirstName,
  initialLastName,
  savedAddresses,
}: Pick<
  CheckoutFormProps,
  "initialEmail" | "initialFirstName" | "initialLastName" | "savedAddresses"
>): CheckoutFormInput {
  const defaultAddress = savedAddresses.find((address) => address.is_default);
  return {
    shipping: {
      first_name: defaultAddress?.first_name || initialFirstName,
      last_name: defaultAddress ? defaultAddress.last_name : initialLastName,
      email: initialEmail,
      phone: defaultAddress?.phone || "",
      street_address: defaultAddress?.street_address || "",
      apartment: defaultAddress?.apartment || "",
      city: defaultAddress?.city || "",
      state: defaultAddress?.state || "",
      postal_code: defaultAddress?.postal_code || "",
      delivery_instructions: defaultAddress?.delivery_instructions || "",
    },
    preferred_payment: "card",
    save_address: savedAddresses.length === 0,
  };
}

const checkoutAddressFieldNames: Record<AddressFieldName, FieldPath<CheckoutFormInput>> = {
  first_name: "shipping.first_name",
  last_name: "shipping.last_name",
  street_address: "shipping.street_address",
  apartment: "shipping.apartment",
  city: "shipping.city",
  state: "shipping.state",
  phone: "shipping.phone",
  postal_code: "shipping.postal_code",
  delivery_instructions: "shipping.delivery_instructions",
};

export function CheckoutForm({
  initialEmail,
  initialFirstName,
  initialLastName,
  savedAddresses,
}: CheckoutFormProps) {
  const router = useRouter();
  const { isHydrated, items, totalPrice } = useCart();
  const { unavailableItems, priceNotice, isRefreshingPrices } =
    useCartPriceRefresh();
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [priceChangeConfirmation, setPriceChangeConfirmation] = useState<{
    priceChanges: PriceChange[];
    orderId: string;
    paymentLink?: string;
  } | null>(null);
  const hasUnavailableItems = unavailableItems.length > 0;
  const [idempotencyState, setIdempotencyState] = useState<{
    signature: string;
    key: string;
  } | null>(null);
  const form = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    mode: "onBlur",
    defaultValues: getDefaultValues({
      initialEmail,
      initialFirstName,
      initialLastName,
      savedAddresses,
    }),
  });
  const defaultAddress = savedAddresses.find((address) => address.is_default);
  const preferredPayment = useWatch({
    control: form.control,
    name: "preferred_payment",
  }) as PaymentPreference | undefined;

  useEffect(() => {
    if (isHydrated && items.length === 0) {
      router.replace("/shop");
    }
  }, [isHydrated, items.length, router]);

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
    trackEvent("address.used_at_checkout");
  };

  const handleEnterNewAddress = () => {
    form.setValue(
      "shipping",
      {
        first_name: "",
        last_name: "",
        email: initialEmail,
        phone: "",
        street_address: "",
        apartment: "",
        city: "",
        state: "",
        postal_code: "",
        delivery_instructions: "",
      },
      { shouldDirty: true },
    );
    form.clearErrors("shipping");
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

    if (!isHydrated) {
      return;
    }

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
      save_address: values.save_address,
      order_source: "self",
    });

    if (!payload.success) {
      setGlobalError("Check your checkout details and try again.");
      return;
    }

    setSubmitting(true);
    trackEvent("checkout.shipping_completed", {
      has_saved_address: savedAddresses.length > 0,
    });

    const checkoutSignature = getCheckoutSignature(items, payload.data.shipping);
    let idempotencyKey: string;

    if (idempotencyState && idempotencyState.signature === checkoutSignature) {
      idempotencyKey = idempotencyState.key;
    } else {
      idempotencyKey = generateIdempotencyKey();
      setIdempotencyState({ signature: checkoutSignature, key: idempotencyKey });
    }

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
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

      if (data.price_changed && data.price_changes?.length) {
        trackEvent("flash_sale.price_changed_at_checkout", {
          order_id: data.order_id,
          changed_item_count: data.price_changes.length,
        });
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
              disabled={submitting || !isHydrated}
              className="space-y-6 lg:col-span-2 lg:col-start-1 lg:row-start-1"
            >
              <AddressSelector
                addresses={savedAddresses}
                onSelect={applyAddress}
                onEnterNewAddress={handleEnterNewAddress}
                defaultAddressId={defaultAddress?.id}
                disabled={submitting || !isHydrated}
              />

              <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                <div className="space-y-4">
                  <AddressForm
                    control={form.control}
                    fieldName={(field) => checkoutAddressFieldNames[field]}
                    phoneRequired
                    lastNameOptional
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
                </div>
                <label className="mt-5 flex items-start gap-3 border-t border-line pt-4 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="mt-1 accent-brand"
                    {...form.register("save_address")}
                  />
                  <span>Save this address for next time</span>
                </label>
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
                <div className="mt-3 rounded-xl bg-brand-light px-4 py-3 text-sm text-danger">
                  Remove unavailable items from your cart before checkout.
                </div>
              ) : null}
            </div>

            <div className="space-y-4 lg:col-span-2 lg:col-start-1 lg:row-start-2">
              <PaymentMethodSelector
                value={preferredPayment || "card"}
                onChange={handlePaymentChange}
                disabled={submitting || !isHydrated}
              />

              {globalError ? (
                <p className="rounded-xl bg-brand-light px-4 py-3 text-sm font-medium text-danger">
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
                  !isHydrated ||
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

      <PriceChangeDialog
        open={Boolean(priceChangeConfirmation)}
        priceChanges={priceChangeConfirmation?.priceChanges ?? []}
        onContinue={continueToPayment}
      />
    </section>
  );
}
