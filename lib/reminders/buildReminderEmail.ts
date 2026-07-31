import { OCCASION_LABELS } from "@/lib/occasion/constants";
import type { OccasionType } from "@/lib/occasion/types";
import { daysFromToday, formatOccasionDate } from "@/lib/occasion/date";
import { getAppUrl } from "@/lib/env";

// Not imported from lib/wishlist/shared.ts on purpose — that module also
// pulls in Sanity fetch machinery this purely-formatting file has no need
// for (and which drags an extra required env var into anything importing it).
function buildWishlistShareUrl(shareId: string) {
  return `${getAppUrl()}/w/${shareId}`;
}

export interface DueReminderRow {
  id: string;
  reminder_type: string;
  channel: string;
  scheduled_at: string;
  days_before: number | null;
  retry_count: number;
  user_id: string;
  important_date_id: string | null;
  invite_id: string | null;
  occasion_id: string | null;
  advance_expected_date: string | null;
  important_dates: ImportantDateJoin | ImportantDateJoin[] | null;
  occasions: OccasionJoin | OccasionJoin[] | null;
  wishlist_invites: InviteJoin | InviteJoin[] | null;
}

interface ImportantDateJoin {
  person_name: string;
  occasion_type: string;
  date: string;
  linked_wishlist_id: string | null;
  is_recurring: boolean;
}

interface OccasionJoin {
  title: string;
  occasion_type: string;
  occasion_date: string;
}

interface InviteJoin {
  wishlist_id: string;
  token: string;
  wishlists: WishlistJoin | WishlistJoin[] | null;
}

interface WishlistJoin {
  title: string;
  occasions: OccasionJoin | OccasionJoin[] | null;
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] || null : value;
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

function occasionLabel(occasionType: string) {
  return OCCASION_LABELS[occasionType as OccasionType] || "occasion";
}

function resolveDays(daysBefore: number | null, scheduledDate: string) {
  return daysBefore ?? Math.max(daysFromToday(scheduledDate), 0);
}

function unsubscribeUrl(token: string, type: "owner" | "invitee") {
  return `${getAppUrl()}/api/reminders/unsubscribe?token=${encodeURIComponent(
    token,
  )}&type=${type}`;
}

function wrapEmail({
  greeting,
  body,
  ctaLabel,
  ctaUrl,
  unsubscribe,
}: {
  greeting: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribe: string;
}) {
  const text = [
    greeting,
    body,
    ctaUrl ? `${ctaLabel}: ${ctaUrl}` : null,
    `Unsubscribe: ${unsubscribe}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;">
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(body)}</p>
      ${
        ctaUrl
          ? `<p>
              <a href="${ctaUrl}" style="display: inline-block; border-radius: 999px; background: #C50404; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 600;">
                ${escapeHtml(ctaLabel || "View")}
              </a>
            </p>`
          : ""
      }
      <p style="margin-top: 24px; font-size: 12px; color: #666666;">
        <form method="post" action="${unsubscribe}" style="display: inline;">
          <button type="submit" style="background: none; border: 0; padding: 0; color: #666666; text-decoration: underline; cursor: pointer; font: inherit;">Unsubscribe from this reminder</button>
        </form>
      </p>
    </div>
  `;

  return { html, text };
}

export function buildReminderEmail({
  reminder,
  recipientEmail,
}: {
  reminder: DueReminderRow;
  recipientEmail: string;
}): { to: string; subject: string; html: string; text: string } | null {
  const daysBefore = reminder.days_before ?? null;

  if (
    reminder.reminder_type === "occasion_owner" &&
    reminder.important_date_id
  ) {
    const importantDate = first(reminder.important_dates);

    if (!importantDate) {
      return null;
    }

    const days = resolveDays(daysBefore, importantDate.date);
    const wishlistUrl = importantDate.linked_wishlist_id
      ? buildWishlistShareUrl(importantDate.linked_wishlist_id)
      : null;
    const subject = `🎁 ${importantDate.person_name}'s ${occasionLabel(
      importantDate.occasion_type,
    )} is in ${days} ${days === 1 ? "day" : "days"}`;
    const { html, text } = wrapEmail({
      greeting: `Reminder that ${importantDate.person_name}'s ${occasionLabel(
        importantDate.occasion_type,
      )} is on ${formatOccasionDate(importantDate.date)}.`,
      body: wishlistUrl
        ? `View their wishlist for gift ideas, or browse Givftme for something special.`
        : `Browse gift ideas on Givftme.`,
      ctaLabel: wishlistUrl ? "View their wishlist" : "Browse gift ideas",
      ctaUrl: wishlistUrl || getAppUrl(),
      unsubscribe: unsubscribeUrl(reminder.important_date_id, "owner"),
    });

    return { to: recipientEmail, subject, html, text };
  }

  if (reminder.reminder_type === "occasion_owner" && reminder.occasion_id) {
    const occasion = first(reminder.occasions);

    if (!occasion) {
      return null;
    }

    const days = resolveDays(daysBefore, occasion.occasion_date);
    const subject = `🎉 Your ${occasionLabel(occasion.occasion_type)} is in ${days} ${
      daysBefore === 1 ? "day" : "days"
    }`;
    const { html, text } = wrapEmail({
      greeting: `Your ${occasionLabel(occasion.occasion_type)} — ${occasion.title} — is on ${formatOccasionDate(
        occasion.occasion_date,
      )}.`,
      body: "Make sure your wishlist is up to date so the people gifting you know what to get.",
      ctaLabel: "View your wishlist",
      ctaUrl: `${getAppUrl()}/wishlists`,
      unsubscribe: unsubscribeUrl(reminder.occasion_id, "owner"),
    });

    return { to: recipientEmail, subject, html, text };
  }

  if (reminder.reminder_type === "invitee" && reminder.invite_id) {
    const invite = first(reminder.wishlist_invites);
    const wishlist = invite ? first(invite.wishlists) : null;
    const occasion = wishlist ? first(wishlist.occasions) : null;

    if (!invite || !occasion) {
      return null;
    }

    const days = resolveDays(daysBefore, occasion.occasion_date);
    const subject = `🎂 ${occasion.title} is in ${days} ${daysBefore === 1 ? "day" : "days"}`;
    const { html, text } = wrapEmail({
      greeting: `Just a reminder — ${occasion.title} (${occasionLabel(
        occasion.occasion_type,
      )}) is on ${formatOccasionDate(occasion.occasion_date)}.`,
      body: "View their wishlist and buy a gift before it's gone.",
      ctaLabel: "View wishlist",
      ctaUrl: buildWishlistShareUrl(invite.token),
      unsubscribe: unsubscribeUrl(reminder.invite_id, "invitee"),
    });

    return { to: recipientEmail, subject, html, text };
  }

  return null;
}
