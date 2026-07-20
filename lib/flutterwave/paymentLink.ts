const FLUTTERWAVE_PAYMENT_HOSTS = new Set(["checkout.flutterwave.com"]);

export function isAllowedFlutterwavePaymentLink(
  value: string | null | undefined
): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      FLUTTERWAVE_PAYMENT_HOSTS.has(url.hostname.toLowerCase()) &&
      url.pathname.startsWith("/v3/hosted/pay/")
    );
  } catch {
    return false;
  }
}
