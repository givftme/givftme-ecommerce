import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { daysBetween, eventContextFromHeaders, type EventRequestContext } from "@/lib/events/context";
import { ANON_ID_COOKIE, SESSION_ID_COOKIE, type EventName } from "@/lib/events/names";
import { createServiceClient } from "@/lib/supabase/server";

export interface RecordEventInput {
  event: EventName;
  userId?: string | null;
  anonId?: string | null;
  sessionId?: string | null;
  context?: Partial<EventRequestContext>;
  props?: Record<string, unknown>;
}

const MAX_PROP_STRING = 500;

// Long free text (search queries, referrers) is clipped so one row can't
// bloat the log; nested objects are kept as-is.
function cleanProps(props: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, MAX_PROP_STRING) : value]),
  );
}

/**
 * Appends one row to the event log via the service role. Never throws and
 * never blocks the caller's own outcome: a lost analytics row is always
 * preferable to a failed checkout, signup, or page.
 */
export async function recordEvent(input: RecordEventInput, client?: SupabaseClient): Promise<void> {
  try {
    const supabase = client ?? createServiceClient();
    const row: Record<string, unknown> = {
      event: input.event,
      user_id: input.userId ?? null,
      anon_id: input.anonId ?? null,
      session_id: input.sessionId ?? null,
      device: input.context?.device ?? null,
      platform: "web",
      city: input.context?.city ?? null,
      props: cleanProps(input.props),
    };
    // Omitted rather than null so the column default ('NG') applies.
    if (input.context?.country) row.country = input.context.country;

    const { error } = await supabase.from("events").insert(row);
    if (error) console.error(`Could not record ${input.event} event.`, error);
  } catch (error) {
    console.error(`Could not record ${input.event} event.`, error);
  }
}

/** Device, geo, and visitor ids for the request being handled, if any. */
export async function currentRequestEventFields(): Promise<
  Pick<RecordEventInput, "anonId" | "sessionId" | "context">
> {
  try {
    const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
    return {
      anonId: cookieStore.get(ANON_ID_COOKIE)?.value ?? null,
      sessionId: cookieStore.get(SESSION_ID_COOKIE)?.value ?? null,
      context: eventContextFromHeaders(headerStore),
    };
  } catch {
    // Outside a request (tests, scripts) there is nothing to attach.
    return {};
  }
}

/** The referring site's hostname for the current request, if any. */
export async function currentReferrerHost(): Promise<string | null> {
  try {
    const referer = (await headers()).get("referer");
    return referer ? new URL(referer).hostname : null;
  } catch {
    return null;
  }
}

/** Records an event with the current request's device, geo, and visitor ids. */
export async function recordRequestEvent(input: Omit<RecordEventInput, "anonId" | "sessionId" | "context">) {
  const fields = await currentRequestEventFields();
  await recordEvent({ ...fields, ...input });
}

/**
 * For pages: captures the request's fields now, then writes after the
 * response is sent, so recording never adds latency to a customer page.
 */
export async function recordRequestEventAfter(input: Omit<RecordEventInput, "anonId" | "sessionId" | "context">) {
  const fields = await currentRequestEventFields();
  try {
    after(() => recordEvent({ ...fields, ...input }));
  } catch {
    await recordEvent({ ...fields, ...input });
  }
}

/**
 * Where a person was last seen. Webhooks arrive from the payment provider,
 * not the giver, so the giver's own last request is the best location signal.
 */
export async function lastKnownLocation(
  service: SupabaseClient,
  userId: string,
): Promise<Partial<EventRequestContext>> {
  try {
    const { data } = await service
      .from("events")
      .select("city, country, device")
      .eq("user_id", userId)
      .not("country", "is", null)
      .neq("event", "admin_action")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { city: data.city, country: data.country, device: data.device } : {};
  } catch {
    return {};
  }
}

const REMINDER_ACTION_WINDOW_MS = 48 * 60 * 60 * 1000;

/** `reminder_actioned` when a person orders or claims within 48h of a reminder. */
export async function recordReminderActioned(
  service: SupabaseClient,
  userId: string,
  target: { order_id?: string; purchase_id?: string },
) {
  try {
    const since = new Date(Date.now() - REMINDER_ACTION_WINDOW_MS).toISOString();
    const { data } = await service
      .from("events")
      .select("props")
      .eq("user_id", userId)
      .eq("event", "reminder_sent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    const props = (data.props || {}) as Record<string, unknown>;
    await recordEvent({
      event: "reminder_actioned",
      userId,
      props: {
        channel: props.channel,
        days_before: props.days_before,
        message_id: props.message_id,
        ...target,
      },
    }, service);
  } catch (error) {
    console.error("Could not record reminder_actioned event.", error);
  }
}

interface OccasionLink {
  occasion_date: string | null;
  occasion_type: string | null;
}

type MaybeArray<T> = T | T[] | null;
const first = <T,>(value: MaybeArray<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

async function occasionForWishlistItem(service: SupabaseClient, itemId: string): Promise<OccasionLink | null> {
  const { data } = await service
    .from("wishlist_items")
    .select("wishlists(occasions(occasion_date, occasion_type))")
    .eq("id", itemId)
    .maybeSingle();
  const wishlist = first((data as { wishlists: MaybeArray<{ occasions: MaybeArray<OccasionLink> }> } | null)?.wishlists ?? null);
  return first(wishlist?.occasions ?? null);
}

/**
 * Everything a newly paid catalog order says about planning behaviour:
 * `order_placed`, plus `date_recovered` when it was for an occasion that had
 * already passed and `reminder_actioned` when a reminder preceded it.
 * Call once, on the first confirmation only.
 */
export async function recordOrderPlacedEvents(service: SupabaseClient, orderId: string) {
  try {
    const { data: order } = await service
      .from("orders")
      .select("id, buyer_id, total_amount, created_at, wishlist_item_id, order_items(quantity)")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.buyer_id) return;

    const items = ((order.order_items || []) as { quantity: number | null }[])
      .reduce((sum, item) => sum + (item.quantity ?? 1), 0);
    const occasion = order.wishlist_item_id
      ? await occasionForWishlistItem(service, order.wishlist_item_id)
      : null;
    const leadTimeDays = occasion?.occasion_date
      ? daysBetween(new Date(order.created_at), new Date(`${occasion.occasion_date}T12:00:00+01:00`))
      : null;
    const context = await lastKnownLocation(service, order.buyer_id);

    await recordEvent({
      event: "order_placed",
      userId: order.buyer_id,
      context,
      props: {
        order_id: order.id,
        items,
        value: Number(order.total_amount),
        lead_time_days: leadTimeDays,
        occasion_type: occasion?.occasion_type ?? null,
        channel: order.wishlist_item_id ? "wishlist_gift" : "shop",
      },
    }, service);

    if (leadTimeDays !== null && leadTimeDays < 0) {
      await recordEvent({
        event: "date_recovered",
        userId: order.buyer_id,
        context,
        props: { order_id: order.id, days_late: -leadTimeDays },
      }, service);
    }

    await recordReminderActioned(service, order.buyer_id, { order_id: order.id });
  } catch (error) {
    console.error("Could not record order_placed events.", error);
  }
}
