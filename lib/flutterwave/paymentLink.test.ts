import { describe, expect, it } from "vitest";
import { isAllowedFlutterwavePaymentLink } from "./paymentLink";

describe("Flutterwave hosted payment links", () => {
  it.each([
    "https://checkout.flutterwave.com/v3/hosted/pay/test-link",
    "https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/test-link",
  ])("accepts the provider's hosted checkout URL %s", (link) => {
    expect(isAllowedFlutterwavePaymentLink(link)).toBe(true);
  });

  it.each([
    "http://checkout-v2.dev-flutterwave.com/v3/hosted/pay/test-link",
    "https://checkout-v2.dev-flutterwave.com/captcha/verify/test-link",
    "https://checkout-v2.dev-flutterwave.com.evil.example/v3/hosted/pay/test-link",
    "https://other.dev-flutterwave.com/v3/hosted/pay/test-link",
    "https://checkout-v2.dev-flutterwave.com@evil.example/v3/hosted/pay/test-link",
  ])("rejects unsupported or deceptive checkout URL %s", (link) => {
    expect(isAllowedFlutterwavePaymentLink(link)).toBe(false);
  });
});
