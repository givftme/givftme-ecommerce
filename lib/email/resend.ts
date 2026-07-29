interface WishlistInviteEmailInput {
  to: string;
  receiverName: string;
  wishlistUrl: string;
}

function getConfiguredFromEmail() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!from) {
    return null;
  }

  return from.includes("<") ? from : `Gifvtme <${from}>`;
}

export async function sendWishlistInviteEmail({
  to,
  receiverName,
  wishlistUrl,
}: WishlistInviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getConfiguredFromEmail();

  // Resend delivery requires RESEND_API_KEY, RESEND_FROM_EMAIL, and a verified
  // sender domain in the Resend dashboard. Invite creation still succeeds
  // without email so sharing is not blocked during local setup.
  if (!apiKey || !from) {
    console.warn(
      "Wishlist invite email not sent: Resend is not fully configured."
    );
    return { sent: false };
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
      })[char] as string,
  );
}

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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Wishlist invite email failed.", await response.text());
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("Wishlist invite email failed.", error);
    return { sent: false };
  }
}
