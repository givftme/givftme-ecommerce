import { getAppUrl, requireEnv } from "@/lib/env";
import type { PaymentPreference } from "@/lib/checkout/validation";
import { createFlutterwaveTransactionRef } from "@/lib/flutterwave/paymentReference";

const FLUTTERWAVE_PAYMENTS_URL = "https://api.flutterwave.com/v3/payments";
const FLUTTERWAVE_REQUEST_TIMEOUT_MS = 15_000;

interface FlutterwaveCustomer {
  email: string;
  name: string;
  phone: string;
}

interface InitiateFlutterwavePaymentInput {
  orderId: string;
  amount: number;
  customer: FlutterwaveCustomer;
  preferredPayment?: PaymentPreference;
}

interface FlutterwavePaymentsResponse {
  status?: string;
  message?: string;
  data?: {
    link?: string;
  };
}

export interface FlutterwavePaymentResult {
  ok: boolean;
  paymentLink?: string;
  error?: string;
}

function getPaymentOptions(preferredPayment?: PaymentPreference) {
  return preferredPayment ?? "card,banktransfer,ussd";
}

export async function initiateFlutterwavePayment({
  orderId,
  amount,
  customer,
  preferredPayment,
}: InitiateFlutterwavePaymentInput): Promise<FlutterwavePaymentResult> {
  const appUrl = getAppUrl();
  const secretKey = requireEnv(
    process.env.FLUTTERWAVE_SECRET_KEY,
    "FLUTTERWAVE_SECRET_KEY"
  );
  const transactionRef = createFlutterwaveTransactionRef(orderId);

  // Flutterwave setup notes:
  // - Configure the dashboard webhook URL as [your-domain]/api/flutterwave/webhook.
  // - FLUTTERWAVE_SECRET_HASH is the custom Webhooks hash set in Flutterwave.
  // - The Flutterwave account must be configured for Nigerian Naira (NGN).
  const response = await fetch(FLUTTERWAVE_PAYMENTS_URL, {
    method: "POST",
    signal: AbortSignal.timeout(FLUTTERWAVE_REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: transactionRef,
      amount,
      currency: "NGN",
      redirect_url: `${appUrl}/checkout/processing?order=${orderId}`,
      meta: {
        order_id: orderId,
      },
      customer: {
        email: customer.email,
        name: customer.name,
        phonenumber: customer.phone,
      },
      customizations: {
        title: "Gifvtme",
        description: `Order #${orderId.slice(0, 8)}`,
        logo: `${appUrl}/logo.png`,
      },
      payment_options: getPaymentOptions(preferredPayment),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | FlutterwavePaymentsResponse
    | null;

  if (!response.ok || payload?.status !== "success" || !payload.data?.link) {
    return {
      ok: false,
      error: payload?.message || "Payment could not be initiated.",
    };
  }

  return {
    ok: true,
    paymentLink: payload.data.link,
  };
}
