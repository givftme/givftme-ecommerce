import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initiateFlutterwavePayment } from "./index";

const orderId = "11111111-1111-4111-8111-111111111111";
const customer = {
  email: "buyer@example.com",
  name: "Test Buyer",
  phone: "08012345678",
};
const secretKey = "FLWSECK_TEST-diagnostic-private-key";
const secretHash = "diagnostic-private-webhook-hash";

describe("Flutterwave initialization", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_APP_URL", "http://localhost:3000");
    vi.stubEnv("FLUTTERWAVE_SECRET_KEY", secretKey);
    vi.stubEnv("FLUTTERWAVE_SECRET_HASH", secretHash);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("records an HTML provider rejection as one string with status and order reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><title>Attention Required! | Cloudflare</title></html>", {
        status: 403,
        headers: { "Content-Type": "text/html", Server: "cloudflare" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await initiateFlutterwavePayment({
      orderId,
      amount: 25000,
      customer,
      preferredPayment: "card",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Flutterwave HTTP 403");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/payments",
      expect.objectContaining({ method: "POST" })
    );
    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(info).toHaveBeenCalledOnce();
    const [entry] = info.mock.calls[0];
    expect(info.mock.calls[0]).toHaveLength(1);
    expect(entry).toBeTypeOf("string");
    const diagnostic = JSON.parse(entry.slice(entry.indexOf("{")));
    expect(diagnostic).toMatchObject({
      orderId,
      tx_ref: sentPayload.tx_ref,
      httpStatus: 403,
      contentType: "text/html",
      server: "cloudflare",
      responseFormat: "non_json",
      providerStatus: null,
      providerMessage: null,
      hasPaymentLink: false,
    });
    expect(entry).not.toContain("<html>");
    expect(entry).not.toContain(secretKey);
  });

  it("redacts secrets and customer details from a provider message", async () => {
    const message = `Rejected ${secretKey} ${secretHash} ${customer.email} ${customer.name} ${customer.phone}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ status: "error", message }, { status: 400 })
    ));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await initiateFlutterwavePayment({ orderId, amount: 25000, customer });

    const [entry] = info.mock.calls[0];
    for (const sensitive of [secretKey, secretHash, ...Object.values(customer)]) {
      expect(entry).not.toContain(sensitive);
      expect(result.error).not.toContain(sensitive);
    }
    const diagnostic = JSON.parse(entry.slice(entry.indexOf("{")));
    expect(diagnostic.providerMessage).toBe(
      "Rejected [redacted] [redacted] [redacted] [redacted] [redacted]"
    );
    expect(diagnostic.httpStatus).toBe(400);
    expect(diagnostic.providerStatus).toBe("error");
  });

  it("returns a successful hosted link while logging only its presence", async () => {
    const link = "https://checkout.flutterwave.com/v3/hosted/pay/test-link";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ status: "success", message: `Hosted Link ${link}`, data: { link } })
    ));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await initiateFlutterwavePayment({ orderId, amount: 25000, customer }))
      .toEqual({ ok: true, paymentLink: link });
    const [entry] = info.mock.calls[0];
    const diagnostic = JSON.parse(entry.slice(entry.indexOf("{")));
    expect(diagnostic.hasPaymentLink).toBe(true);
    expect(diagnostic.providerStatus).toBe("success");
    expect(entry).not.toContain(link);
  });

  it("keeps an unexpected response status object out of the log", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ status: { secretKey, customer }, message: "Invalid response" })
    ));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await initiateFlutterwavePayment({ orderId, amount: 25000, customer });

    expect(result.ok).toBe(false);
    const [entry] = info.mock.calls[0];
    const diagnostic = JSON.parse(entry.slice(entry.indexOf("{")));
    expect(diagnostic.providerStatus).toBeNull();
    expect(entry).not.toContain(secretKey);
    expect(entry).not.toContain(customer.email);
  });

  it("receives a hosted link from the provider that blocks an Order # description", async () => {
    const link = "https://checkout.flutterwave.com/v3/hosted/pay/test-link";
    // The live test API returned Cloudflare 403 for Order #<id>, then 200
    // when only the hash was removed from the same request's description.
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      if (payload.customizations.description.startsWith("Order #")) {
        return new Response("<html>Sorry, you have been blocked</html>", {
          status: 403,
          headers: { "Content-Type": "text/html", Server: "cloudflare" },
        });
      }
      return Response.json({ status: "success", message: "Hosted Link", data: { link } });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await initiateFlutterwavePayment({
      orderId,
      amount: 30000,
      customer,
      preferredPayment: "card",
    });

    expect(result).toEqual({ ok: true, paymentLink: link });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      amount: 30000,
      currency: "NGN",
      meta: { order_id: orderId },
      payment_options: "card",
    });
  });
});
