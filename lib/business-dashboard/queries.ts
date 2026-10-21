import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { namesForUsers } from "@/lib/admin/data/orders";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/profile";
import type { AccountType } from "@/lib/business/entry";
import { BUSINESS_ROLES, RULES, type BusinessRole } from "@/lib/business-dashboard/data";
import type {
  BusinessAccount,
  BusinessCampaign,
  BusinessDashboardData,
  BusinessDelivery,
  BusinessMember,
  BusinessPerson,
  RuleState,
} from "@/lib/business-dashboard/types";
import { createServiceClient } from "@/lib/supabase/server";

// Supabase reads for the business dashboard, always scoped to one
// business_account_id. They use the service role, so callers must have
// resolved the member first (getBusinessSession) and pass only that
// member's account id.

const ACCOUNT_COLUMNS =
  "id, company_name, brand_color, logo_url, default_message, plan, annual_budget, budget_used, delivery_fee, per_head_default, reminder_contact, reminder_cc_email, reminder_channel, auto_approve_under, created_at";
const PERSON_COLUMNS =
  "id, kind, name, department, role_title, bday, start_date, company, relationship, account_owner, tier";
const CAMPAIGN_COLUMNS =
  "id, name, occasion, audience, heads, per_head, delivery_fee, delivery_date, gift_type, card_message, status, owner, created_at";
const DELIVERY_COLUMNS =
  "id, campaign_id, recipient_name, recipient_group, occasion, gift_type, photo_url, delivered_at, status, exception_note";

const PAGE_SIZE = 1000;

/** Reads every row past PostgREST's 1,000-row response cap. */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const toNumber = (value: unknown) => Number(value ?? 0);

function normalizeAccount(row: Record<string, unknown>): BusinessAccount {
  return {
    ...(row as unknown as BusinessAccount),
    annual_budget: toNumber(row.annual_budget),
    budget_used: toNumber(row.budget_used),
    delivery_fee: toNumber(row.delivery_fee),
    per_head_default: toNumber(row.per_head_default),
    auto_approve_under: toNumber(row.auto_approve_under),
  };
}

function normalizeCampaign(row: Record<string, unknown>): BusinessCampaign {
  return {
    ...(row as unknown as BusinessCampaign),
    heads: toNumber(row.heads),
    per_head: toNumber(row.per_head),
    delivery_fee: toNumber(row.delivery_fee),
  };
}

function isBusinessRole(value: unknown): value is BusinessRole {
  return typeof value === "string" && (BUSINESS_ROLES as readonly string[]).includes(value);
}

export interface BusinessSession {
  user: User | null;
  member: BusinessMember | null;
  /** users.account_type, the flag proxy.ts gates the dashboard on; null when unknown. */
  accountType: AccountType | null;
}

/**
 * The signed-in user, their business membership (first account when they
 * belong to several) and account type. Membership is what authorizes; the
 * account type only lets callers spot a login whose two records disagree.
 * Deduplicated per request, sharing the user and profile reads with PageWrapper.
 */
export const getBusinessSession = cache(async (): Promise<BusinessSession> => {
  const user = await getCurrentUser();
  if (!user) return { user: null, member: null, accountType: null };

  const service = createServiceClient();
  const { data, error } = await service
    .from("business_users")
    .select("id, account_id, user_id, role, department, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load business membership: ${error.message}`);
  const profile = await getCurrentProfile(user.id);
  if (!data || !isBusinessRole(data.role)) return { user, member: null, accountType: profile.account_type };

  const email = user.email || "";
  return {
    user,
    accountType: profile.account_type,
    member: {
      id: data.id,
      account_id: data.account_id,
      user_id: data.user_id,
      role: data.role,
      department: data.department,
      full_name: profile.full_name || email.split("@")[0] || "Team member",
      email,
    },
  };
});

export async function getBusinessAccount(service: SupabaseClient, accountId: string): Promise<BusinessAccount> {
  const { data, error } = await service.from("business_accounts").select(ACCOUNT_COLUMNS).eq("id", accountId).single();
  if (error) throw new Error(`Could not load business account: ${error.message}`);
  return normalizeAccount(data);
}

/** Active staff and clients, oldest first. */
export async function listBusinessPeople(service: SupabaseClient, accountId: string): Promise<BusinessPerson[]> {
  return selectAll<BusinessPerson>((from, to) =>
    service
      .from("business_people")
      .select(PERSON_COLUMNS)
      .eq("account_id", accountId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

/**
 * Campaigns by delivery date. A `limited` member only sees campaigns whose
 * owner is them (spec "Permissions").
 */
export async function listBusinessCampaigns(
  service: SupabaseClient,
  accountId: string,
  member?: Pick<BusinessMember, "role" | "full_name">,
): Promise<BusinessCampaign[]> {
  const rows = await selectAll<Record<string, unknown>>((from, to) => {
    let query = service
      .from("business_campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("account_id", accountId);
    if (member?.role === "limited") query = query.eq("owner", member.full_name);
    return query.order("delivery_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  return rows.map(normalizeCampaign);
}

export async function listBusinessDeliveries(service: SupabaseClient, accountId: string): Promise<BusinessDelivery[]> {
  const { data, error } = await service
    .from("business_deliveries")
    .select(DELIVERY_COLUMNS)
    .eq("account_id", accountId)
    .order("delivered_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []) as BusinessDelivery[];
}

/** Every rule with its stored state, falling back to the spec defaults. */
export async function getBusinessRules(service: SupabaseClient, accountId: string): Promise<RuleState> {
  const { data, error } = await service.from("business_rules").select("rule_key, enabled").eq("account_id", accountId);
  if (error) throw new Error(error.message);
  const stored = new Map((data || []).map((row) => [row.rule_key as string, Boolean(row.enabled)]));
  return Object.fromEntries(RULES.map((rule) => [rule.key, stored.get(rule.key) ?? rule.enabled]));
}

export async function listBusinessTeam(service: SupabaseClient, accountId: string): Promise<BusinessMember[]> {
  const { data, error } = await service
    .from("business_users")
    .select("id, account_id, user_id, role, department")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((row) => isBusinessRole(row.role));
  // public.users has no email column; names and emails come from the same
  // auth-joined lookup the admin screens use.
  const display = await namesForUsers(service, rows.map((row) => row.user_id as string));
  return rows.map((row) => {
    const contact = display.get(row.user_id as string);
    const email = contact?.email || "";
    return {
      id: row.id as string,
      account_id: row.account_id as string,
      user_id: row.user_id as string,
      role: row.role as BusinessRole,
      department: row.department as string | null,
      full_name: contact?.full_name || email.split("@")[0] || "Team member",
      email,
    };
  });
}

/** Everything the dashboard shell needs, in parallel. */
export async function loadBusinessDashboard(member: BusinessMember): Promise<BusinessDashboardData> {
  const service = createServiceClient();
  const [account, people, campaigns, deliveries, rules, team] = await Promise.all([
    getBusinessAccount(service, member.account_id),
    listBusinessPeople(service, member.account_id),
    listBusinessCampaigns(service, member.account_id, member),
    listBusinessDeliveries(service, member.account_id),
    getBusinessRules(service, member.account_id),
    listBusinessTeam(service, member.account_id),
  ]);
  return { account, member, people, campaigns, deliveries, rules, team };
}
