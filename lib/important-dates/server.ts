import type { SupabaseClient } from "@supabase/supabase-js";
import { isPastDateOnly, parseDateOnly, toDateOnly } from "@/lib/occasion/date";
import type { OccasionType } from "@/lib/occasion/types";
import {
  rescheduleImportantDateReminders,
  scheduleImportantDateReminders,
} from "@/lib/reminders/scheduleImportantDateReminders";
import type { ImportantDate } from "@/lib/important-dates/types";
import type {
  ImportantDateInput,
  UpdateImportantDateInput,
} from "@/lib/important-dates/validation";

interface ImportantDateRow {
  id: string;
  person_name: string;
  occasion_type: string;
  date: string;
  is_recurring: boolean;
  linked_wishlist_id: string | null;
  created_at: string;
}

function normalizeImportantDate(row: ImportantDateRow): ImportantDate {
  return {
    id: row.id,
    person_name: row.person_name,
    occasion_type: (row.occasion_type as OccasionType) || "other",
    date: row.date,
    is_recurring: row.is_recurring,
    linked_wishlist_id: row.linked_wishlist_id,
    created_at: row.created_at,
  };
}

const SELECT_COLUMNS =
  "id, person_name, occasion_type, date, is_recurring, linked_wishlist_id, created_at";

// Thrown only for input-driven failures that are safe to show verbatim to
// the user (e.g. a wishlist link that doesn't resolve). Route handlers use
// this to decide whether a caught error's message can be surfaced as-is or
// must be replaced with a generic message — raw DB error messages (column
// names, constraint details) must never reach the client.
export class ImportantDateInputError extends Error {}

function extractShareId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/w\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function resolveLinkedWishlistId(
  supabase: SupabaseClient,
  wishlistUrl: string
): Promise<string> {
  const shareId = extractShareId(wishlistUrl);

  if (!shareId) {
    throw new ImportantDateInputError("That doesn't look like a Gifvtme wishlist link.");
  }

  const { data, error } = await supabase.rpc("gifvtme_get_shared_wishlist", {
    p_share_key: shareId,
  });

  if (error) {
    throw new ImportantDateInputError("Couldn't verify that wishlist link.");
  }

  const payload = data as { access?: string; wishlist?: { id?: string } } | null;

  if (payload?.access !== "ok" || !payload.wishlist?.id) {
    throw new ImportantDateInputError("Couldn't find that wishlist. Check the link and try again.");
  }

  return payload.wishlist.id;
}

export async function getImportantDates(
  supabase: SupabaseClient,
  userId: string
): Promise<ImportantDate[]> {
  const { data, error } = await supabase
    .from("important_dates")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as ImportantDateRow[]).map(normalizeImportantDate);
}

export async function assertImportantDateOwner(
  supabase: SupabaseClient,
  id: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("important_dates")
    .select(`${SELECT_COLUMNS}, user_id`)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as (ImportantDateRow & { user_id: string }) | null;

  if (!row || row.user_id !== userId) {
    return { ok: false as const, status: 404, error: "Date not found." };
  }

  return { ok: true as const, importantDate: normalizeImportantDate(row) };
}

export async function createImportantDate({
  supabase,
  userId,
  input,
}: {
  supabase: SupabaseClient;
  userId: string;
  input: ImportantDateInput;
}): Promise<ImportantDate> {
  let linkedWishlistId: string | null = null;

  if (input.linked_wishlist_url) {
    linkedWishlistId = await resolveLinkedWishlistId(supabase, input.linked_wishlist_url);
  }

  const { data, error } = await supabase
    .from("important_dates")
    .insert({
      user_id: userId,
      person_name: input.person_name,
      occasion_type: input.occasion_type,
      date: input.date,
      is_recurring: input.is_recurring,
      linked_wishlist_id: linkedWishlistId,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("Important date insert failed.", error);
    throw new Error("Couldn't save this date.");
  }

  const importantDate = normalizeImportantDate(data as ImportantDateRow);

  // Same boundary importantDateSchema.date validation uses (rejects only
  // strictly-past dates) — a date of today is valid input, so it should at
  // least attempt scheduling too, not be silently skipped by a stricter
  // "strictly future" check here. scheduleImportantDateReminders' own
  // filter still drops any resulting scheduled_at that's already passed.
  if (!isPastDateOnly(importantDate.date)) {
    try {
      await scheduleImportantDateReminders({
        supabase,
        userId,
        importantDateId: importantDate.id,
        date: importantDate.date,
      });
    } catch (scheduleError) {
      console.error("Important date reminder scheduling failed.", scheduleError);
    }
  }

  return importantDate;
}

export async function updateImportantDate({
  supabase,
  userId,
  id,
  existing,
  input,
}: {
  supabase: SupabaseClient;
  userId: string;
  id: string;
  existing: ImportantDate;
  input: UpdateImportantDateInput;
}): Promise<ImportantDate> {
  const updates: Record<string, unknown> = {};

  if (input.person_name !== undefined) updates.person_name = input.person_name;
  if (input.occasion_type !== undefined) updates.occasion_type = input.occasion_type;
  if (input.date !== undefined) updates.date = input.date;
  if (input.is_recurring !== undefined) updates.is_recurring = input.is_recurring;

  if (input.linked_wishlist_url !== undefined) {
    updates.linked_wishlist_id = input.linked_wishlist_url
      ? await resolveLinkedWishlistId(supabase, input.linked_wishlist_url)
      : null;
  }

  const { data, error } = await supabase
    .from("important_dates")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("Important date update failed.", error);
    throw new Error("Couldn't update this date.");
  }

  const updated = normalizeImportantDate(data as ImportantDateRow);
  const dateChanged = input.date !== undefined && input.date !== existing.date;

  if (dateChanged) {
    await rescheduleImportantDateReminders({
      supabase,
      userId,
      importantDateId: id,
      date: updated.date,
    });
  }

  return updated;
}

// A single statement, not a separate "delete unsent reminders then delete
// the date" sequence — migration 015 gives reminders.important_date_id an
// explicit ON DELETE CASCADE, so this atomically removes every reminder
// that pointed at this date (sent or unsent) along with the row itself.
export async function deleteImportantDate({
  supabase,
  userId,
  id,
}: {
  supabase: SupabaseClient;
  userId: string;
  id: string;
}) {
  const { error } = await supabase
    .from("important_dates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

// Called by the reminders cron after the 3-day reminder fires for a
// recurring important date — advances to next year's occurrence and
// reschedules. Feb 29 birthdays advance to Feb 28 in non-leap years (JS
// Date's own month-rollover behavior on setFullYear is how we detect this) —
// a Postgres `date` column can't hold an invalid Feb 29. Known limitation:
// once substituted to Feb 28, the original day is no longer stored, so a
// Feb-29 birthday will keep advancing as Feb 28 rather than "waiting" to
// land back on Feb 29 in the next leap year. Fixing that would need a
// separate original-day column — out of scope here.
export async function advanceRecurringImportantDate({
  supabase,
  userId,
  importantDateId,
  date,
}: {
  supabase: SupabaseClient;
  userId: string;
  importantDateId: string;
  date: string;
}) {
  const current = parseDateOnly(date);

  if (!current) {
    return;
  }

  const next = new Date(current);
  next.setFullYear(next.getFullYear() + 1);

  if (current.getMonth() === 1 && current.getDate() === 29 && next.getMonth() !== 1) {
    next.setMonth(1, 28);
  }

  const nextDate = toDateOnly(next);

  const { error } = await supabase
    .from("important_dates")
    .update({ date: nextDate })
    .eq("id", importantDateId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  try {
    await scheduleImportantDateReminders({
      supabase,
      userId,
      importantDateId,
      date: nextDate,
    });
  } catch (scheduleError) {
    console.error("Recurring important date reminder scheduling failed.", scheduleError);
  }
}
