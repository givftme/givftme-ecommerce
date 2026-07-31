interface WishlistInviteEmailInput {
  to: string;
  receiverName: string;
  wishlistUrl: string;
}

interface RawEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Reused across retries of the same logical send (e.g. the reminder's own
  // row id) so a request that actually reached Resend but whose response we
  // lost (timeout, network error) doesn't cause a real duplicate email when
  // the caller retries — Resend dedupes by this key.
  idempotencyKey?: string;
}

function getConfiguredFromEmail() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!from) {
    return null;
  }

  return from.includes("<") ? from : `Gifvtme <${from}>`;
}

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
      })[char] as string
  );
}

// Resend delivery requires RESEND_API_KEY, RESEND_FROM_EMAIL, and a verified
// sender domain in the Resend dashboard. Callers must keep working (invite
// creation, reminder scheduling) without email so setup gaps never block
// the underlying feature — the caller decides how to treat `sent: false`.
async function sendViaResend({ to, subject, text, html, idempotencyKey }: RawEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getConfiguredFromEmail();

  if (!apiKey || !from) {
    console.warn("Email not sent: Resend is not fully configured.");
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Email send failed.", await response.text());
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("Email send failed.", error);
    return { sent: false };
  }
}

export async function sendWishlistInviteEmail({
  to,
  receiverName,
  wishlistUrl,
}: WishlistInviteEmailInput) {
  const subject = `${receiverName} shared their wishlist with you`;
  const text = `${receiverName} has invited you to see their wishlist. View it here: ${wishlistUrl}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;">
      <p>${escapeHtml(receiverName)} has invited you to see their wishlist.</p>
      <p>Click below to view it.</p>
      <p>
        <a href="${wishlistUrl}" style="display: inline-block; border-radius: 999px; background: #C50404; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 600;">
          View wishlist
        </a>
      </p>
    </div>
  `;

  return sendViaResend({ to, subject, text, html });
}

export async function sendReminderEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}: RawEmailInput) {
  return sendViaResend({ to, subject, text, html, idempotencyKey });
}

export async function sendThankYouEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}: RawEmailInput) {
  return sendViaResend({ to, subject, text, html, idempotencyKey });
}
