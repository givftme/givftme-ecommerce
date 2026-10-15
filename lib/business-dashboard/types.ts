import type {
  BusinessRole,
  CampaignStatus,
  GiftTier,
  ReminderChannel,
} from "@/lib/business-dashboard/data";

export type PersonKind = "staff" | "client";

export interface BusinessAccount {
  id: string;
  company_name: string;
  brand_color: string;
  logo_url: string | null;
  default_message: string;
  plan: "Pulse" | "Seasons" | "Signature";
  annual_budget: number;
  budget_used: number;
  delivery_fee: number;
  per_head_default: number;
  reminder_contact: string | null;
  reminder_cc_email: string | null;
  reminder_channel: ReminderChannel;
  auto_approve_under: number;
  created_at: string;
}

export interface BusinessMember {
  id: string;
  account_id: string;
  user_id: string;
  role: BusinessRole;
  department: string | null;
  full_name: string;
  email: string;
}

export interface BusinessPerson {
  id: string;
  kind: PersonKind;
  name: string;
  department: string | null;
  role_title: string | null;
  bday: string; // MM-DD
  start_date: string | null; // YYYY-MM-DD
  company: string | null;
  relationship: string | null;
  account_owner: string | null;
  tier: GiftTier;
}

export interface BusinessCampaign {
  id: string;
  name: string;
  occasion: string;
  audience: string;
  heads: number;
  per_head: number;
  delivery_fee: number;
  delivery_date: string; // YYYY-MM-DD
  gift_type: string;
  card_message: string | null;
  status: CampaignStatus;
  owner: string | null;
  created_at: string;
}

export interface BusinessDelivery {
  id: string;
  campaign_id: string | null;
  recipient_name: string;
  recipient_group: string | null;
  occasion: string | null;
  gift_type: string | null;
  photo_url: string | null;
  delivered_at: string | null;
  status: "scheduled" | "delivered" | "failed" | "rebooked";
  exception_note: string | null;
}

export type RuleState = Record<string, boolean>;

/** Everything the dashboard shell renders, loaded once on the server. */
export interface BusinessDashboardData {
  account: BusinessAccount;
  member: BusinessMember;
  people: BusinessPerson[];
  campaigns: BusinessCampaign[];
  deliveries: BusinessDelivery[];
  rules: RuleState;
  team: BusinessMember[];
}

export type MomentType = "birthday" | "anniversary" | "campaign";

export interface UpcomingMoment {
  id: string;
  type: MomentType;
  /** "Birthday", "5 years", or "Campaign". */
  label: string;
  who: string;
  sub: string;
  date: Date;
  days: number;
  tier: GiftTier | null;
  kind: PersonKind | "campaign";
  /** The campaign's occasion; null for people. */
  occasion: string | null;
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
