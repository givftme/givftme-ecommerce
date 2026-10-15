import type { SupabaseClient } from "@supabase/supabase-js";
import { suppressSmallGroup } from "@/lib/admin/privacy";
import { SEGMENTS, type SegmentId, type SegmentMember } from "@/lib/admin/segments";

export interface FunnelRow {
  signed_up: number;
  saved_one_date: number;
  saved_three_dates: number;
  created_wishlist: number;
  shared_link: number;
  first_order: number;
  second_order: number;
}

const FUNNEL_STEPS: { key: keyof FunnelRow; label: string }[] = [
  { key: "signed_up", label: "Signed up" },
  { key: "saved_one_date", label: "Saved 1 date" },
  { key: "saved_three_dates", label: "Saved 3+ dates" },
  { key: "created_wishlist", label: "Created wishlist" },
  { key: "shared_link", label: "Shared a link" },
  { key: "first_order", label: "First order" },
  { key: "second_order", label: "Second order" },
];

export interface FunnelStep {
  key: keyof FunnelRow;
  label: string;
  users: number;
  /** Share of the previous step lost at this one; null for the first step. */
  dropOff: number | null;
}

export function buildFunnel(row: Partial<FunnelRow> | null | undefined): FunnelStep[] {
  return FUNNEL_STEPS.map((step, index) => {
    const users = Number(row?.[step.key] ?? 0);
    const previous = index === 0 ? null : Number(row?.[FUNNEL_STEPS[index - 1]!.key] ?? 0);
    return {
      ...step,
      users,
      dropOff: previous ? Math.max(0, ((previous - users) / previous) * 100) : null,
    };
  });
}

export async function getFunnel(service: SupabaseClient) {
  const { data, error } = await service.rpc("gifvtme_admin_activation_funnel");
  if (error) throw new Error(error.message);
  return buildFunnel((Array.isArray(data) ? data[0] : data) as FunnelRow | null);
}

export interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  d7: number | null;
  d14: number | null;
  d30: number | null;
  d60: number | null;
  d90: number | null;
}

export async function getCohorts(service: SupabaseClient, weeks = 12): Promise<CohortRow[]> {
  const { data, error } = await service.rpc("gifvtme_admin_cohort_retention", { p_weeks: weeks });
  if (error) throw new Error(error.message);
  return ((data || []) as CohortRow[]).map((row) => ({
    ...row,
    cohort_week: String(row.cohort_week).slice(0, 10),
    cohort_size: Number(row.cohort_size),
    d7: row.d7 == null ? null : Number(row.d7),
    d14: row.d14 == null ? null : Number(row.d14),
    d30: row.d30 == null ? null : Number(row.d30),
    d60: row.d60 == null ? null : Number(row.d60),
    d90: row.d90 == null ? null : Number(row.d90),
  }));
}

export async function getSegmentCount(service: SupabaseClient, id: SegmentId) {
  const { count, error } = await service.rpc("gifvtme_admin_segment_members", { p_segment: id }, { head: true, count: "exact" });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getSegmentCounts(service: SupabaseClient) {
  const counts = await Promise.all(SEGMENTS.map((segment) => getSegmentCount(service, segment.id)));
  return Object.fromEntries(SEGMENTS.map((segment, index) => [segment.id, counts[index]!])) as Record<SegmentId, number>;
}

export async function getSegmentPreview(service: SupabaseClient, id: SegmentId) {
  const { data, count, error } = await service
    .rpc("gifvtme_admin_segment_members", { p_segment: id }, { count: "exact" })
    .range(0, 9);
  if (error) throw new Error(error.message);
  return { count: count ?? 0, rows: (data || []) as SegmentMember[], refreshedAt: new Date().toISOString() };
}

const PAGE = 1000;

/**
 * Every member, paged past PostgREST's row cap, then held back entirely when
 * the segment describes fewer than 50 people (privacy rule 1).
 */
export async function getSegmentExport(service: SupabaseClient, id: SegmentId) {
  const members: SegmentMember[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await service
      .rpc("gifvtme_admin_segment_members", { p_segment: id })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    members.push(...((data || []) as SegmentMember[]));
    if (!data || data.length < PAGE) break;
  }
  return { total: members.length, ...suppressSmallGroup(members) };
}
