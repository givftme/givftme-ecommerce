import { beforeAll, describe, expect, it } from "vitest";
import { buildReminderEmail, type DueReminderRow } from "./buildReminderEmail";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL ||= "https://gifvtme.test";
});

function futureDateOnly(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function baseReminder(overrides: Partial<DueReminderRow>): DueReminderRow {
  return {
    id: "reminder-1",
    reminder_type: "occasion_owner",
    channel: "email",
    scheduled_at: new Date().toISOString(),
    days_before: 14,
    retry_count: 0,
    user_id: "user-1",
    important_date_id: null,
    invite_id: null,
    occasion_id: null,
    advance_expected_date: null,
    important_dates: null,
    occasions: null,
    wishlist_invites: null,
    ...overrides,
  };
}

describe("buildReminderEmail — Flow 1 (important date owner)", () => {
  it("builds an email with a wishlist link when linked_wishlist_id is set", () => {
    const reminder = baseReminder({
      important_date_id: "date-1",
      important_dates: {
        person_name: "Mum",
        occasion_type: "birthday",
        date: futureDateOnly(14),
        linked_wishlist_id: "wishlist-1",
        is_recurring: true,
      },
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "user@example.com",
    });

    expect(email).not.toBeNull();
    expect(email?.to).toBe("user@example.com");
    expect(email?.subject).toContain("Mum's Birthday");
    expect(email?.html).toContain("/w/wishlist-1");
  });

  it("omits the wishlist link when linked_wishlist_id is null", () => {
    const reminder = baseReminder({
      important_date_id: "date-1",
      important_dates: {
        person_name: "Dad",
        occasion_type: "anniversary",
        date: futureDateOnly(3),
        linked_wishlist_id: null,
        is_recurring: false,
      },
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "user@example.com",
    });

    expect(email).not.toBeNull();
    expect(email?.html).not.toContain("/w/");
  });

  it("returns null when the important date has been deleted (orphaned reminder)", () => {
    const reminder = baseReminder({
      important_date_id: "date-1",
      important_dates: null,
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "user@example.com",
    });

    expect(email).toBeNull();
  });
});

describe("buildReminderEmail — occasion owner (user's own occasion)", () => {
  it("builds an email referencing the occasion title", () => {
    const reminder = baseReminder({
      occasion_id: "occasion-1",
      occasions: {
        title: "My Birthday Bash",
        occasion_type: "birthday",
        occasion_date: futureDateOnly(14),
      },
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "user@example.com",
    });

    expect(email).not.toBeNull();
    expect(email?.html).toContain("My Birthday Bash");
  });

  it("returns null when the occasion has been deleted", () => {
    const reminder = baseReminder({
      occasion_id: "occasion-1",
      occasions: null,
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "user@example.com",
    });

    expect(email).toBeNull();
  });
});

describe("buildReminderEmail — Flow 2 (invitee)", () => {
  it("builds an email using the invite token for the wishlist link", () => {
    const reminder = baseReminder({
      reminder_type: "invitee",
      invite_id: "invite-1",
      wishlist_invites: {
        wishlist_id: "wishlist-1",
        token: "abc123",
        wishlists: {
          title: "Sarah's Wishlist",
          occasions: {
            title: "Sarah's Birthday",
            occasion_type: "birthday",
            occasion_date: futureDateOnly(3),
          },
        },
      },
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "giver@example.com",
    });

    expect(email).not.toBeNull();
    expect(email?.subject).toContain("Sarah's Birthday");
    expect(email?.html).toContain("/w/abc123");
  });

  it("returns null when the invite's occasion can't be resolved", () => {
    const reminder = baseReminder({
      reminder_type: "invitee",
      invite_id: "invite-1",
      wishlist_invites: {
        wishlist_id: "wishlist-1",
        token: "abc123",
        wishlists: null,
      },
    });

    const email = buildReminderEmail({
      reminder,
      recipientEmail: "giver@example.com",
    });

    expect(email).toBeNull();
  });
});
