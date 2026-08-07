import { describe, expect, it } from "vitest";
import { buildOrderStatusEmail } from "./buildOrderStatusEmail";

const base = {
  orderId: "11111111-2222-3333-4444-555566667777",
  orderUrl: "https://gifvtme.com/account/orders/11111111-2222-3333-4444-555566667777",
};

describe("buildOrderStatusEmail", () => {
  it("confirmed: matches spec copy and links to the order", () => {
    const email = buildOrderStatusEmail({ ...base, status: "confirmed" });
    expect(email.text).toContain(
      "Your order is confirmed! We're reviewing it and will prepare it for shipment soon.",
    );
    expect(email.html).toContain(base.orderUrl);
  });

  it("shipped: includes tracking number and links to the carrier tracking URL", () => {
    const email = buildOrderStatusEmail({
      ...base,
      status: "shipped",
      trackingNumber: "GIG123456",
      trackingUrl: "https://gigl.ng/track/GIG123456",
      carrierName: "GIG Logistics",
    });
    expect(email.text).toContain("Tracking number: GIG123456.");
    expect(email.html).toContain("https://gigl.ng/track/GIG123456");
    expect(email.html).toContain("Track on GIG Logistics");
  });

  it("shipped: falls back to the order link when no tracking URL is set yet", () => {
    const email = buildOrderStatusEmail({ ...base, status: "shipped" });
    expect(email.html).toContain(base.orderUrl);
    expect(email.html).toContain("View your order");
  });

  it("delivered: matches spec copy", () => {
    const email = buildOrderStatusEmail({ ...base, status: "delivered" });
    expect(email.text).toContain(
      "Your order has been delivered! We hope you love it.",
    );
  });

  it("cancelled: includes the reason when provided", () => {
    const email = buildOrderStatusEmail({
      ...base,
      status: "cancelled",
      cancelReason: "Item out of stock",
    });
    expect(email.text).toContain(
      "Your order has been cancelled. Item out of stock. Contact support if this was unexpected.",
    );
  });

  it("cancelled: omits the reason clause when none is provided", () => {
    const email = buildOrderStatusEmail({ ...base, status: "cancelled" });
    expect(email.text).toContain(
      "Your order has been cancelled. Contact support if this was unexpected.",
    );
  });

  it("refunded: matches spec copy", () => {
    const email = buildOrderStatusEmail({ ...base, status: "refunded" });
    expect(email.text).toContain(
      "Your refund has been processed. It may take 3–7 business days to appear.",
    );
  });

  it("throws for a non-customer-facing status", () => {
    expect(() =>
      buildOrderStatusEmail({
        ...base,
        status: "under_review" as never,
      }),
    ).toThrow('No customer email template for status "under_review"');
  });
});
