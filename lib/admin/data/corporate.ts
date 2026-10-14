import type { SupabaseClient } from "@supabase/supabase-js";
import { namesForUsers, userContacts } from "@/lib/admin/data/orders";

// There is no corporate account table yet, so a company account is a
// business enquiry that reached `won`. Its orders are the ones placed by the
// user whose email matches the enquiry's contact email. With no campaign
// model, each paid order counts as a gifting campaign; plans aren't recorded.

export type AccountHealth = "healthy" | "drifting" | "at-risk";

const DAY = 86_400_000;
const PAID = ["confirmed", "under_review", "forwarded", "shipped", "delivered"];

/** Healthy within 60 days of the last order, drifting to 120, then at risk. */
export function accountHealth(lastOrderAt: string | null, wonAt: string, now = new Date()): AccountHealth {
  const since = lastOrderAt ?? wonAt;
  const days = (now.getTime() - new Date(since).getTime()) / DAY;
  if (!lastOrderAt) return days <= 30 ? "healthy" : days <= 60 ? "drifting" : "at-risk";
  if (days <= 60) return "healthy";
  if (days <= 120) return "drifting";
  return "at-risk";
}

export interface CorporateAccount {
  enquiry_id: string;
  company: string;
  contact_name: string;
  email: string | null;
  plan: string | null;
  campaigns: number;
  last_campaign_at: string | null;
  total_spend: number;
  account_manager: string | null;
  health: AccountHealth;
  user_id: string | null;
  won_at: string;
}

interface CorporateOrder {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  buyer_id: string;
}

export async function listCorporateAccounts(service: SupabaseClient) {
  const { data: enquiries, error } = await service
    .from("business_enquiries")
    .select("id, company_name, contact_name, email, assigned_to, created_at")
    .eq("status", "won")
    .order("company_name");
  if (error) throw new Error(error.message);

  const emails = [...new Set((enquiries || []).map((row) => row.email?.toLowerCase()).filter(Boolean))] as string[];
  const users = await userContacts(service, { emails });
  const userByEmail = new Map(users.filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user.id]));

  const userIds = [...userByEmail.values()];
  const { data: orders, error: ordersError } = userIds.length
    ? await service.from("orders").select("id, status, total_amount, created_at, buyer_id")
        .in("buyer_id", userIds).in("status", PAID).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (ordersError) throw new Error(ordersError.message);

  const managers = await namesForUsers(service, (enquiries || []).map((row) => row.assigned_to).filter(Boolean));
  const accounts: CorporateAccount[] = (enquiries || []).map((row) => {
    const userId = row.email ? userByEmail.get(row.email.toLowerCase()) ?? null : null;
    const own = ((orders || []) as CorporateOrder[]).filter((order) => order.buyer_id === userId);
    const lastAt = own[0]?.created_at ?? null;
    return {
      enquiry_id: row.id,
      company: row.company_name,
      contact_name: row.contact_name,
      email: row.email,
      plan: null,
      campaigns: own.length,
      last_campaign_at: lastAt,
      total_spend: own.reduce((sum, order) => sum + Number(order.total_amount), 0),
      account_manager: row.assigned_to ? managers.get(row.assigned_to)?.full_name ?? null : null,
      health: accountHealth(lastAt, row.created_at),
      user_id: userId,
      won_at: row.created_at,
    };
  });
  return { accounts, orders: (orders || []) as CorporateOrder[] };
}

export async function getCorporateHistory(service: SupabaseClient, enquiryId: string) {
  const { data, error } = await service
    .from("admin_actions")
    .select("action, created_at, admin_id, metadata")
    .eq("target_type", "business_enquiry")
    .eq("target_id", enquiryId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const admins = await namesForUsers(service, (data || []).map((row) => row.admin_id));
  return (data || []).map((row) => ({
    action: row.action,
    created_at: row.created_at,
    admin_name: admins.get(row.admin_id)?.full_name ?? null,
    metadata: (row.metadata || {}) as Record<string, unknown>,
  }));
}
