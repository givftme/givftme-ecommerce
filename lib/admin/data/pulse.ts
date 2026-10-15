import type { SupabaseClient } from "@supabase/supabase-js";

export const PULSE_KPIS = [
  { key: "signups", label: "Signups", money: false },
  { key: "active", label: "Active", money: false },
  { key: "dates_saved", label: "Dates saved", money: false },
  { key: "lists_created", label: "Lists created", money: false },
  { key: "links_shared", label: "Links shared", money: false },
  { key: "orders_placed", label: "Orders placed", money: false },
  { key: "collected", label: "Collected", money: true },
] as const;

export type PulseKpiKey = (typeof PULSE_KPIS)[number]["key"];
export type PulseDay = { day: string } & Record<PulseKpiKey, number>;

export interface PulseKpi {
  key: PulseKpiKey;
  label: string;
  money: boolean;
  today: number;
  yesterday: number;
  /** Today minus yesterday. */
  delta: number;
  /** The last seven days, oldest first, ending today. */
  series: number[];
}

export interface PulseOperations {
  due_today: number;
  out_for_delivery: number;
  delivered_today: number;
  late: number;
  failed_deliveries: number;
}

export interface NeedsHumanItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface PulseData {
  kpis: PulseKpi[];
  operations: PulseOperations;
  needsHuman: NeedsHumanItem[];
}

/** Shapes the eight-day series from gifvtme_admin_pulse() into KPI cards. */
export function buildPulseKpis(days: PulseDay[]): PulseKpi[] {
  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day));
  return PULSE_KPIS.map(({ key, label, money }) => {
    const values = ordered.map((day) => Number(day[key] ?? 0));
    const today = values.at(-1) ?? 0;
    const yesterday = values.at(-2) ?? 0;
    return { key, label, money, today, yesterday, delta: today - yesterday, series: values.slice(-7) };
  });
}

function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: total, error } = await query;
  if (error) throw new Error(error.message);
  return total ?? 0;
}

export async function getPulse(service: SupabaseClient): Promise<PulseData> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const today = lagosToday();

  const [pulse, failedPayments, failedReminders, deliveryExceptions, payouts, enquiries] = await Promise.all([
    service.rpc("gifvtme_admin_pulse"),
    count(service.from("orders").select("id", { count: "exact", head: true })
      .eq("status", "payment_failed").gt("created_at", dayAgo)),
    count(service.from("reminders").select("id", { count: "exact", head: true })
      .eq("permanently_failed", true).is("sent_at", null).eq("dismissed", false)),
    count(service.from("orders").select("id", { count: "exact", head: true })
      .eq("status", "shipped").lt("estimated_delivery", today)),
    count(service.from("pool_payouts").select("id", { count: "exact", head: true })
      .eq("status", "pending_ops_action")),
    count(service.from("business_enquiries").select("id", { count: "exact", head: true })
      .eq("status", "new")),
  ]);
  if (pulse.error) throw new Error(pulse.error.message);

  const data = pulse.data as { days: PulseDay[]; operations: PulseOperations };
  return {
    kpis: buildPulseKpis(data.days || []),
    operations: data.operations,
    needsHuman: [
      { key: "failed_payments", label: "Failed payments (24h)", count: failedPayments, href: "/admin/orders?status=failed" },
      { key: "failed_reminders", label: "Failed reminders", count: failedReminders, href: "/admin/reminders" },
      { key: "delivery_exceptions", label: "Delivery exceptions", count: deliveryExceptions, href: "/admin/orders?status=shipped&late=1" },
      { key: "payouts", label: "Pool payouts pending", count: payouts, href: "/admin/pools?tab=payouts" },
      { key: "enquiries", label: "Business enquiries unread", count: enquiries, href: "/admin/enquiries" },
    ],
  };
}
