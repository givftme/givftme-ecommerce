import type { OrderStatus } from "@/lib/orders/types";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] as string,
  );
}

function ctaButton(label: string, url: string) {
  return `<p><a href="${escapeHtml(url)}" style="display: inline-block; border-radius: 999px; background: #C50404; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 600;">${escapeHtml(label)}</a></p>`;
}

function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function shortOrderId(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

export interface OrderStatusEmailInput {
  status: OrderStatus;
  orderId: string;
  orderUrl: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrierName?: string | null;
  cancelReason?: string | null;
}

interface OrderStatusEmailContent {
  subject: string;
  message: string;
  cta: { label: string; url: string };
}

// Copy per status straight from 16-ORDER-TRACKING.md's "Email templates per
// status" section. `delivered`'s spec copy links to a review flow that
// doesn't exist yet (reviews are still "not started" per ROADMAP.md) — that
// CTA points at the order instead until /api/reviews ships.
function buildContent(input: OrderStatusEmailInput): OrderStatusEmailContent {
  const shortId = shortOrderId(input.orderId);

  switch (input.status) {
    case "confirmed":
      return {
        subject: `✅ Order #${shortId} confirmed`,
        message:
          "Your order is confirmed! We're reviewing it and will prepare it for shipment soon.",
        cta: { label: "View your order", url: input.orderUrl },
      };
    case "shipped": {
      const trackingUrl = isHttpsUrl(input.trackingUrl)
        ? input.trackingUrl
        : null;

      const tracking = input.trackingNumber
        ? ` Tracking number: ${input.trackingNumber}.`
        : "";
      return {
        subject: `📦 Order #${shortId} is on its way`,
        message: `Your order is on its way!${tracking}`,
        cta: {
          label: trackingUrl
            ? `Track on ${input.carrierName || "carrier"}`
            : "View your order",
          url: trackingUrl || input.orderUrl,
        },
      };
    }
    case "delivered":
      return {
        subject: `🎉 Order #${shortId} has been delivered`,
        message: "Your order has been delivered! We hope you love it.",
        cta: { label: "View your order", url: input.orderUrl },
      };
    case "cancelled": {
      const reason = input.cancelReason ? ` ${input.cancelReason}.` : "";
      return {
        subject: `Order #${shortId} has been cancelled`,
        message: `Your order has been cancelled.${reason} Contact support if this was unexpected.`,
        cta: { label: "View your order", url: input.orderUrl },
      };
    }
    case "refunded":
      return {
        subject: `💸 Order #${shortId} refund processed`,
        message:
          "Your refund has been processed. It may take 3–7 business days to appear.",
        cta: { label: "View your order", url: input.orderUrl },
      };
    default:
      throw new Error(
        `No customer email template for status "${input.status}"`,
      );
  }
}

export function buildOrderStatusEmail(input: OrderStatusEmailInput) {
  const { subject, message, cta } = buildContent(input);
  const text = `${message}\n\n${cta.label}: ${cta.url}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;">
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      ${ctaButton(cta.label, cta.url)}
    </div>
  `;

  return { subject, text, html };
}
