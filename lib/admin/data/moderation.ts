import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/admin/audit";
import { namesForUsers, userContacts } from "@/lib/admin/data/orders";
import type { EnquiryStatus, EnquiryUpdate } from "@/lib/admin/validation";
import type { BusinessEnquiryValues } from "@/lib/business/validation";
import { sanityFetch } from "@/lib/sanity/fetch";
import { ADMIN_PRODUCT_TITLES_QUERY } from "@/lib/sanity/queries";

type MutationResult = { ok: true } | { ok: false; status: number; error: string };
type MaybeArray<T> = T | T[] | null;
const first = <T,>(value: MaybeArray<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

/** Opens the product in the embedded Studio regardless of its desk structure. */
export function studioProductUrl(productId: string) {
  return `/studio/intent/edit/id=${encodeURIComponent(productId)};type=product`;
}

// --- Reviews -----------------------------------------------------------

export interface ReviewFilters {
  rating: number | null;
  product: string | null;
  from: string | null;
  to: string | null;
}

export interface AdminReviewRow {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  catalog_product_id: string;
  product_title: string | null;
  reviewer_name: string | null;
}

async function productTitles(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  try {
    const products = await sanityFetch<{ _id: string; title: string }[]>(ADMIN_PRODUCT_TITLES_QUERY, { ids });
    return new Map(products.map((product) => [product._id, product.title]));
  } catch (error) {
    console.error("Could not load product titles for reviews.", error);
    return new Map<string, string>();
  }
}

export async function listAdminReviews(service: SupabaseClient, filters: ReviewFilters) {
  let query = service.from("reviews").select("id, user_id, catalog_product_id, rating, body, created_at");
  if (filters.rating) query = query.eq("rating", filters.rating);
  if (filters.product) query = query.eq("catalog_product_id", filters.product);
  if (filters.from) query = query.gte("created_at", new Date(`${filters.from}T00:00:00+01:00`).toISOString());
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+01:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const [{ data, error }, { data: reviewedProducts, error: productsError }] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(200),
    service.from("reviews").select("catalog_product_id").limit(1000),
  ]);
  if (error) throw new Error(error.message);
  if (productsError) throw new Error(productsError.message);

  const productIds = [...new Set([
    ...(reviewedProducts || []).map((row) => row.catalog_product_id),
    ...(data || []).map((row) => row.catalog_product_id),
  ])];
  const [titles, reviewers] = await Promise.all([
    productTitles(productIds),
    namesForUsers(service, (data || []).map((row) => row.user_id)),
  ]);

  const reviews: AdminReviewRow[] = (data || []).map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    created_at: row.created_at,
    catalog_product_id: row.catalog_product_id,
    product_title: titles.get(row.catalog_product_id) ?? null,
    reviewer_name: reviewers.get(row.user_id)?.full_name ?? null,
  }));
  const products = productIds
    .map((id) => ({ id, title: titles.get(id) ?? id }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return { reviews, products };
}

export async function deleteReviewAsAdmin(service: SupabaseClient, adminId: string, reviewId: string): Promise<MutationResult> {
  const { data, error } = await service
    .from("reviews").delete().eq("id", reviewId).select("id, user_id, catalog_product_id, rating");
  if (error) {
    console.error("Could not delete review.", error);
    return { ok: false, status: 500, error: "Couldn't delete the review. Try again." };
  }
  const deleted = data?.[0];
  if (!deleted) return { ok: false, status: 404, error: "Review not found." };

  await logAdminAction(service, adminId, {
    action: "delete_review",
    targetType: "review",
    targetId: reviewId,
    metadata: { user_id: deleted.user_id, catalog_product_id: deleted.catalog_product_id, rating: deleted.rating },
  });
  return { ok: true };
}

// --- Business enquiries ------------------------------------------------

export interface EnquiryRow {
  id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  occasions: string[];
  team_size: string | null;
  needed_by: string | null;
  notes: string | null;
  reference: string | null;
  status: EnquiryStatus;
  assigned_to: string | null;
  created_at: string;
}

export async function createBusinessEnquiry(
  service: SupabaseClient,
  values: BusinessEnquiryValues,
  reference: string | null,
) {
  const { data, error } = await service
    .from("business_enquiries")
    .insert({
      company_name: values.company,
      contact_name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      occasions: values.occasions,
      team_size: values.teamSize,
      needed_by: /^\d{4}-\d{2}-\d{2}$/.test(values.neededBy) ? values.neededBy : null,
      notes: values.notes || null,
      reference,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listTeamMembers(service: SupabaseClient) {
  const { data, error } = await service
    .from("users").select("id").not("role", "is", null);
  if (error) throw new Error(error.message);
  const members = await userContacts(service, { ids: (data || []).map((row) => row.id) });
  return members.sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
}

export async function listEnquiries(service: SupabaseClient): Promise<EnquiryRow[]> {
  const { data, error } = await service
    .from("business_enquiries").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data || []) as EnquiryRow[];
}

export async function updateEnquiry(
  service: SupabaseClient,
  adminId: string,
  enquiryId: string,
  input: EnquiryUpdate,
): Promise<MutationResult> {
  if (input.assigned_to) {
    const { data: assignee, error } = await service
      .from("users").select("role").eq("id", input.assigned_to).maybeSingle();
    if (error) throw new Error(error.message);
    if (!assignee?.role) return { ok: false, status: 400, error: "Enquiries can only be assigned to team members." };
  }

  const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const { data, error } = await service
    .from("business_enquiries").update(changes).eq("id", enquiryId).select("id");
  if (error) {
    console.error("Could not update enquiry.", error);
    return { ok: false, status: 500, error: "Couldn't update the enquiry. Try again." };
  }
  if (!data?.length) return { ok: false, status: 404, error: "Enquiry not found." };

  await logAdminAction(service, adminId, {
    action: "update_enquiry",
    targetType: "business_enquiry",
    targetId: enquiryId,
    metadata: changes,
  });
  return { ok: true };
}

// --- Reminder failures -------------------------------------------------

export interface ReminderFailureRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  occasion: string;
  channel: string;
  scheduled_at: string;
  retry_count: number;
  last_attempted_at: string | null;
}

interface ReminderRow {
  id: string;
  user_id: string;
  channel: string;
  scheduled_at: string;
  retry_count: number;
  last_attempted_at: string | null;
  reminder_type: string | null;
  important_dates: MaybeArray<{ person_name: string; occasion_type: string }>;
  occasions: MaybeArray<{ title: string }>;
  wishlist_invites: MaybeArray<{ wishlists: MaybeArray<{ title: string }> }>;
}

export async function listReminderFailures(service: SupabaseClient): Promise<ReminderFailureRow[]> {
  const { data, error } = await service
    .from("reminders")
    .select("id, user_id, channel, scheduled_at, retry_count, last_attempted_at, reminder_type, important_dates(person_name, occasion_type), occasions(title), wishlist_invites(wishlists(title))")
    .eq("permanently_failed", true)
    .eq("dismissed", false)
    .order("scheduled_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data || []) as unknown as ReminderRow[];
  const users = await namesForUsers(service, rows.map((row) => row.user_id));
  return rows.map((row) => {
    const date = first(row.important_dates);
    const occasion = first(row.occasions);
    const inviteList = first(first(row.wishlist_invites)?.wishlists ?? null);
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: users.get(row.user_id)?.full_name ?? null,
      user_email: users.get(row.user_id)?.email ?? null,
      occasion: date
        ? `${date.person_name} · ${date.occasion_type.replace(/_/g, " ")}`
        : occasion?.title ?? inviteList?.title ?? "—",
      channel: row.channel,
      scheduled_at: row.scheduled_at,
      retry_count: row.retry_count,
      last_attempted_at: row.last_attempted_at,
    };
  });
}

export async function resolveReminderFailure(
  service: SupabaseClient,
  adminId: string,
  reminderId: string,
  action: "retry" | "dismiss",
): Promise<MutationResult> {
  // Retrying clears the claim too, so the next /api/reminders run picks it up.
  const changes = action === "retry"
    ? { permanently_failed: false, retry_count: 0, dismissed: false, claimed_at: null }
    : { dismissed: true };
  const { data, error } = await service
    .from("reminders").update(changes).eq("id", reminderId).eq("permanently_failed", true).select("id");
  if (error) {
    console.error(`Could not ${action} reminder.`, error);
    return { ok: false, status: 500, error: "Couldn't update the reminder. Try again." };
  }
  if (!data?.length) return { ok: false, status: 404, error: "That reminder isn't in the failure queue any more." };

  await logAdminAction(service, adminId, {
    action: action === "retry" ? "retry_reminder" : "dismiss_reminder",
    targetType: "reminder",
    targetId: reminderId,
  });
  return { ok: true };
}
