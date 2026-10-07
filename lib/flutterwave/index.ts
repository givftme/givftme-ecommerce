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
  switch (preferredPayment) {
    case "banktransfer":
      return "banktransfer";

    case "ussd":
      return "ussd";

    case "card":
    default:
      return "card";
  }
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
        // The provider rejected "Order #..." with Cloudflare 403 in testing.
        description: `Order ${orderId.slice(0, 8)}`,
        logo: `${appUrl}/logo.png`,
      },
      payment_options: getPaymentOptions(preferredPayment),
    }),
  });

  const rawBody = await response.text();
  let payload: FlutterwavePaymentsResponse | null = null;
  try {
    payload = JSON.parse(rawBody) as FlutterwavePaymentsResponse;
  } catch {
    payload = null;
  }

  const sensitiveValues = [
    secretKey,
    process.env.FLUTTERWAVE_SECRET_HASH,
    customer.email,
    customer.name,
    customer.phone,
    typeof payload?.data?.link === "string" ? payload.data.link : undefined,
  ].filter((value): value is string => Boolean(value));
  const redactDiagnosticText = (value: unknown) =>
    typeof value === "string"
      ? sensitiveValues
          .reduce((message, sensitive) => message.replaceAll(sensitive, "[redacted]"), value)
          .slice(0, 500)
      : null;
  const diagnosticMessage = redactDiagnosticText(payload?.message);

  // One string preserves these fields in the Next.js development log.
  // Keep the request body, raw response, and hosted link out of diagnostics.
  console.info(`[Flutterwave] Initialization response ${JSON.stringify({
    orderId,
    tx_ref: transactionRef,
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    server: response.headers.get("server"),
    responseFormat: payload === null ? "non_json" : "json",
    providerStatus: redactDiagnosticText(payload?.status),
    // Success messages can echo customer details in unpredictable formats.
    providerMessage: payload?.status === "success" ? null : diagnosticMessage,
    hasPaymentLink: Boolean(payload?.data?.link),
  })}`);

  if (!response.ok || payload?.status !== "success" || !payload?.data?.link) {
    // payload?.message alone was masking real failures behind a generic
    // fallback whenever Flutterwave's body had no `message` field or
    // wasn't JSON at all (auth failures, proxy/gateway errors) — surface
    // the actual HTTP status and raw body so callers' console.error calls
    // are actually diagnostic instead of always showing the same string.
    return {
      ok: false,
      error:
        diagnosticMessage ||
        `Flutterwave HTTP ${response.status}: ${redactDiagnosticText(rawBody) || "(empty body)"}`,
    };
  }

  return {
    ok: true,
    paymentLink: payload.data.link,
  };
}
