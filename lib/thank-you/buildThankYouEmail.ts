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

function wrapEmail({ greeting, message }: { greeting: string; message: string }) {
  const text = [greeting, message].join("\n\n");
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;">
      <p>${escapeHtml(greeting)}</p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  return { html, text };
}

export function buildAutoThankYouEmail({
  message,
  receiverName,
  itemTitle,
}: {
  message: string;
  receiverName: string;
  itemTitle: string;
}) {
  const subject = `🎁 ${receiverName} says thank you!`;
  const { html, text } = wrapEmail({
    greeting: `Your gift (${itemTitle}) arrived and ${receiverName} wanted you to know:`,
    message,
  });

  return { subject, html, text };
}

export function buildPersonalThankYouEmail({
  message,
  receiverName,
  itemTitle,
}: {
  message: string;
  receiverName: string;
  itemTitle: string;
}) {
  const subject = `💌 A personal message from ${receiverName}`;
  const { html, text } = wrapEmail({
    greeting: `${receiverName} sent you a personal note about your gift (${itemTitle}):`,
    message,
  });

  return { subject, html, text };
}
