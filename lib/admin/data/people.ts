import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteUserAccount } from "@/lib/account/deletion";
import { logAdminAction } from "@/lib/admin/audit";
import type { AdminRole } from "@/lib/admin/roles";
import type { ZipEntry } from "@/lib/admin/zip";

export interface PersonSearchRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: AdminRole | null;
  signed_up_at: string;
  last_active_at: string | null;
}

export async function searchPeople(service: SupabaseClient, query: string, limit = 25): Promise<PersonSearchRow[]> {
  const { data, error } = await service.rpc("gifvtme_admin_search_people", { p_query: query.slice(0, 120), p_limit: limit });
  if (error) throw new Error(error.message);
  return (data || []) as PersonSearchRow[];
}

const PAID_STATUSES = ["confirmed", "under_review", "forwarded", "shipped", "delivered"];
const DAY_MS = 86_400_000;

export interface PersonEvent {
  id: string;
  event: string;
  created_at: string;
  city: string | null;
  country: string | null;
  device: string | null;
  props: Record<string, unknown>;
}

export interface PersonRecord {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: AdminRole | null;
    city: string | null;
    signed_up_at: string | null;
    signup_source: string | null;
    signup_channel: string | null;
    last_sign_in_at: string | null;
    /** Neither is collected by the app yet; null renders as "not tracked". */
    language: string | null;
    plus: boolean | null;
  };
  calendar: {
    dates: { id: string; person_name: string; occasion_type: string; date: string; is_recurring: boolean }[];
    nextUpcoming: { person_name: string; occasion_type: string; date: string } | null;
    streakMonths: number | null;
    missed: { occasion: string | null; days_late: number | null; created_at: string }[];
  };
  lists: {
    id: string;
    title: string;
    type: string;
    visibility: string;
    occasion_title: string | null;
    item_count: number;
    claimed_count: number;
    share_count: number;
  }[];
  pools: {
    created: { id: string; title: string; status: string; amount_raised: number; target_amount: number; role: "creator" | "receiver" }[];
    contributions: { id: string; pool_title: string | null; amount: number; status: string; created_at: string }[];
  };
  orders: { id: string; status: string; total_amount: number; created_at: string; estimated_delivery: string | null; item_count: number }[];
  messages: { message_id: string | null; channel: string | null; days_before: number | null; sent_at: string; opened: boolean; actioned: boolean }[];
  activity: PersonEvent[];
  value: { totalSpent: number; giftsGiven: number; giftsReceived: number; estimatedLtv: number | null };
  consent: {
    email: { subscribed: boolean; since: string | null; source: string | null };
    whatsapp: null;
    sms: null;
    inviteReminderOptIns: number;
  };
}

type MaybeArray<T> = T | T[] | null;
const first = <T,>(value: MaybeArray<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

/** Whole months since a person first saved a date or last missed one. */
export function streakMonths(firstSavedAt: string | null, lastMissedAt: string | null, now = new Date()): number | null {
  if (!firstSavedAt) return null;
  const start = new Date(lastMissedAt && lastMissedAt > firstSavedAt ? lastMissedAt : firstSavedAt);
  let months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * A rough lifetime value: average monthly spend since signup, projected over
 * 24 months. Null until the person has been around for a week and spent.
 */
export function estimateLtv(totalSpent: number, signedUpAt: string | null, now = new Date()): number | null {
  if (!signedUpAt || totalSpent <= 0) return null;
  const ageDays = (now.getTime() - new Date(signedUpAt).getTime()) / DAY_MS;
  if (ageDays < 7) return null;
  return Math.round((totalSpent / Math.max(ageDays / 30.44, 1)) * 24);
}

async function must<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

async function countOf(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getPersonRecord(service: SupabaseClient, userId: string): Promise<PersonRecord | null> {
  const { data: profile, error } = await service.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const [{ data: authData }, dates, wishlists, createdPools, contributions, orders, activity, reminderEvents, signupEvent] = await Promise.all([
    service.auth.admin.getUserById(userId),
    must<PersonRecord["calendar"]["dates"]>(service.from("important_dates")
      .select("id, person_name, occasion_type, date, is_recurring, created_at").eq("user_id", userId).order("date")),
    must<{ id: string; title: string; type: string; visibility: string; occasions: MaybeArray<{ title: string }>; wishlist_items: { status: string }[] | null }[]>(
      service.from("wishlists").select("id, title, type, visibility, occasions(title), wishlist_items(status)")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50)),
    must<{ id: string; title: string; status: string; amount_raised: number; target_amount: number; created_by: string; receiver_id: string }[]>(
      service.from("group_gift_pools").select("id, title, status, amount_raised, target_amount, created_by, receiver_id")
        .or(`created_by.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(50)),
    must<{ id: string; amount: number; status: string; created_at: string; group_gift_pools: MaybeArray<{ title: string }> }[]>(
      service.from("pool_contributions").select("id, amount, status, created_at, group_gift_pools(title)")
        .eq("contributor_id", userId).order("created_at", { ascending: false }).limit(50)),
    must<{ id: string; status: string; total_amount: number; created_at: string; estimated_delivery: string | null; order_items: { quantity: number }[] | null }[]>(
      service.from("orders").select("id, status, total_amount, created_at, estimated_delivery, order_items(quantity)")
        .eq("buyer_id", userId).order("created_at", { ascending: false }).limit(100)),
    must<PersonEvent[]>(service.from("events").select("id, event, created_at, city, country, device, props")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(200)),
    must<{ event: string; created_at: string; props: Record<string, unknown> }[]>(service.from("events")
      .select("event, created_at, props").eq("user_id", userId)
      .in("event", ["reminder_sent", "reminder_opened", "reminder_actioned"])
      .order("created_at", { ascending: false }).limit(500)),
    must<{ props: Record<string, unknown> }[]>(service.from("events").select("props")
      .eq("user_id", userId).eq("event", "user_signed_up").limit(1)),
  ]);

  const wishlistIds = wishlists.map((list) => list.id);
  // public.users has no email column; it lives on the auth user.
  const email = authData?.user?.email ?? null;
  const [shareCounts, purchasesMade, purchasesReceived, newsletter, inviteOptIns, missedEvents] = await Promise.all([
    Promise.all(wishlistIds.map((id) => countOf(service.from("events").select("id", { count: "exact", head: true })
      .eq("event", "wishlist_shared").eq("props->>wishlist_id", id)))),
    countOf(service.from("purchases").select("id", { count: "exact", head: true }).eq("buyer_id", userId)),
    // A count only: claims on this person's own items are never attributed to
    // the givers who made them (privacy rule 2).
    wishlistIds.length
      ? countOf(service.from("purchases").select("id, wishlist_items!inner(wishlist_id)", { count: "exact", head: true })
          .in("wishlist_items.wishlist_id", wishlistIds))
      : Promise.resolve(0),
    email
      ? service.from("newsletter_subscribers").select("created_at").eq("email", email.toLowerCase()).maybeSingle()
      : Promise.resolve({ data: null }),
    countOf(service.from("wishlist_invites").select("id", { count: "exact", head: true })
      .eq("invitee_user_id", userId).eq("reminder_opted_in", true)),
    must<{ created_at: string; props: Record<string, unknown> }[]>(service.from("events").select("created_at, props")
      .eq("user_id", userId).eq("event", "date_missed").order("created_at", { ascending: false }).limit(50)),
  ]);

  const authUser = authData?.user ?? null;
  const signupProps = signupEvent[0]?.props ?? {};
  const signedUpAt = authUser?.created_at ?? null;
  const city = activity.find((event) => event.city)?.city ?? null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

  const firstSaved = (dates as unknown as { created_at: string }[]).reduce<string | null>(
    (earliest, row) => (!earliest || row.created_at < earliest ? row.created_at : earliest), null);
  const upcoming = dates.filter((date) => date.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  const paidOrders = orders.filter((order) => PAID_STATUSES.includes(order.status));
  const totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);

  const opened = new Set(reminderEvents.filter((e) => e.event === "reminder_opened").map((e) => String(e.props.message_id)));
  const actioned = new Set(reminderEvents.filter((e) => e.event === "reminder_actioned").map((e) => String(e.props.message_id)));

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name ?? null,
      email,
      phone: profile.phone ?? null,
      avatar_url: profile.avatar_url ?? null,
      role: profile.role ?? null,
      city,
      signed_up_at: signedUpAt,
      signup_source: (signupProps.source as string) ?? authUser?.app_metadata?.provider ?? null,
      signup_channel: (signupProps.channel as string) ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      language: typeof profile.language === "string" ? profile.language : null,
      plus: typeof profile.is_plus === "boolean" ? profile.is_plus : null,
    },
    calendar: {
      dates: dates.map(({ id, person_name, occasion_type, date, is_recurring }) => ({ id, person_name, occasion_type, date, is_recurring })),
      nextUpcoming: upcoming ? { person_name: upcoming.person_name, occasion_type: upcoming.occasion_type, date: upcoming.date } : null,
      streakMonths: streakMonths(firstSaved, missedEvents[0]?.created_at ?? null),
      missed: missedEvents.map((event) => ({
        occasion: (event.props.occasion as string) ?? null,
        days_late: typeof event.props.days_late === "number" ? event.props.days_late : null,
        created_at: event.created_at,
      })),
    },
    lists: wishlists.map((list, index) => {
      const items = (list.wishlist_items || []).filter((item) => item.status !== "archived");
      return {
        id: list.id,
        title: list.title,
        type: list.type,
        visibility: list.visibility,
        occasion_title: first(list.occasions)?.title ?? null,
        item_count: items.length,
        claimed_count: items.filter((item) => item.status === "purchased").length,
        share_count: shareCounts[index] ?? 0,
      };
    }),
    pools: {
      created: createdPools.map((pool) => ({
        id: pool.id,
        title: pool.title,
        status: pool.status,
        amount_raised: Number(pool.amount_raised),
        target_amount: Number(pool.target_amount),
        role: pool.created_by === userId ? "creator" : "receiver",
      })),
      contributions: contributions.map((contribution) => ({
        id: contribution.id,
        pool_title: first(contribution.group_gift_pools)?.title ?? null,
        amount: Number(contribution.amount),
        status: contribution.status,
        created_at: contribution.created_at,
      })),
    },
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      total_amount: Number(order.total_amount),
      created_at: order.created_at,
      estimated_delivery: order.estimated_delivery,
      item_count: (order.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
    })),
    messages: reminderEvents.filter((event) => event.event === "reminder_sent").map((event) => {
      const messageId = event.props.message_id != null ? String(event.props.message_id) : null;
      return {
        message_id: messageId,
        channel: (event.props.channel as string) ?? null,
        days_before: typeof event.props.days_before === "number" ? event.props.days_before : null,
        sent_at: event.created_at,
        opened: Boolean(messageId && opened.has(messageId)),
        actioned: Boolean(messageId && actioned.has(messageId)),
      };
    }),
    activity,
    value: {
      totalSpent,
      giftsGiven: purchasesMade + orders.filter((order) => PAID_STATUSES.includes(order.status)).length,
      giftsReceived: purchasesReceived,
      estimatedLtv: estimateLtv(totalSpent, signedUpAt),
    },
    consent: {
      email: {
        subscribed: Boolean(newsletter.data),
        since: (newsletter.data as { created_at?: string } | null)?.created_at ?? null,
        source: newsletter.data ? "Newsletter signup" : null,
      },
      whatsapp: null,
      sms: null,
      inviteReminderOptIns: inviteOptIns,
    },
  };
}

/**
 * The person's own data as JSON files for a data-access request. Claims other
 * people made on this person's items are omitted (privacy rule 2): they
 * describe the givers, not the person.
 */
export async function buildPersonExport(service: SupabaseClient, userId: string): Promise<ZipEntry[] | null> {
  const { data: profile, error } = await service.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const [authUser, dates, wishlists, orders, purchases, pools, contributions, reviews, addresses, reminders, events] = await Promise.all([
    service.auth.admin.getUserById(userId).then(({ data }) => data?.user ?? null),
    must(service.from("important_dates").select("*").eq("user_id", userId)),
    must(service.from("wishlists").select("*, wishlist_items(*)").eq("user_id", userId)),
    must(service.from("orders").select("*, order_items(*), order_status_history(*)").eq("buyer_id", userId)),
    must(service.from("purchases").select("*").eq("buyer_id", userId)),
    must(service.from("group_gift_pools").select("*").or(`created_by.eq.${userId},receiver_id.eq.${userId}`)),
    must(service.from("pool_contributions").select("*").eq("contributor_id", userId)),
    must(service.from("reviews").select("*").eq("user_id", userId)),
    must(service.from("addresses").select("*").eq("user_id", userId)),
    must(service.from("reminders").select("*").eq("user_id", userId)),
    must(service.from("events").select("event, created_at, device, platform, city, country, props")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5000)),
  ]);

  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  return [
    {
      name: "profile.json",
      content: json({
        ...profile,
        auth: authUser
          ? { email: authUser.email, created_at: authUser.created_at, last_sign_in_at: authUser.last_sign_in_at, provider: authUser.app_metadata?.provider }
          : null,
      }),
    },
    { name: "important_dates.json", content: json(dates) },
    { name: "wishlists.json", content: json(wishlists) },
    { name: "orders.json", content: json(orders) },
    { name: "gifts_given.json", content: json(purchases) },
    { name: "pools.json", content: json({ pools, contributions }) },
    { name: "reviews.json", content: json(reviews) },
    { name: "addresses.json", content: json(addresses) },
    { name: "reminders.json", content: json(reminders) },
    { name: "activity.json", content: json(events) },
    {
      name: "README.txt",
      content: `Givftme data export for account ${userId}\nGenerated ${new Date().toISOString()}\n\nGifts other people bought from this person's wishlists are not attributed to those givers, by design.\n`,
    },
  ];
}

export type PersonDeletionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Admin-initiated deletion through the customer flow's own path, logged with a reason. */
export async function deletePersonAsAdmin(
  service: SupabaseClient,
  adminId: string,
  userId: string,
  reason: string,
): Promise<PersonDeletionResult> {
  if (userId === adminId) return { ok: false, status: 400, error: "You can't delete your own account from here." };

  const { data: target, error } = await service.from("users").select("id, role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!target) return { ok: false, status: 404, error: "Person not found." };
  if (target.role) return { ok: false, status: 409, error: "Remove this person's team role before deleting their account." };

  const result = await deleteUserAccount(service, service, userId);
  if (!result.success) {
    return result.reason === "active_order"
      ? { ok: false, status: 409, error: "This person has an order in fulfilment. It must be delivered or cancelled first." }
      : { ok: false, status: 500, error: "Account deletion failed. Try again." };
  }

  await logAdminAction(service, adminId, {
    action: "delete_person",
    targetType: "user",
    targetId: userId,
    metadata: { reason },
  });
  return { ok: true };
}
