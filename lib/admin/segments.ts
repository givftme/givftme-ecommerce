// Lifecycle segments. Each id is a branch of gifvtme_admin_segment_members()
// in gifvtme_migration_041; keep the two in step.
//
// The spec defers to "all lifecycle segments from the document"
// (Givftme-07-Admin-and-Data-Layer.docx), which is not in this repository.
// These definitions cover the activation, sharing, and repeat-gifting
// stages the spec's funnel tracks, and should be checked against that
// document. "Paid order" means one that reached `confirmed`.
export const SEGMENTS = [
  {
    id: "signed_up_no_date",
    name: "Signed up, no dates",
    definition: "Signed up more than 2 days ago and hasn't saved an important date.",
  },
  {
    id: "one_date_saved",
    name: "One date saved",
    definition: "Has saved exactly one important date.",
  },
  {
    id: "planners_no_order",
    name: "Planners who haven't ordered",
    definition: "Has saved 3 or more dates and never placed a paid order.",
  },
  {
    id: "date_soon_no_order",
    name: "Date coming up, no recent order",
    definition: "Has a saved date in the next 14 days and no paid order in the last 30 days.",
  },
  {
    id: "list_not_shared",
    name: "Wishlist never shared",
    definition: "Has a wishlist with at least one item but has never shared a link.",
  },
  {
    id: "one_time_givers",
    name: "One-time givers",
    definition: "Exactly one paid order, placed more than 30 days ago.",
  },
  {
    id: "repeat_givers",
    name: "Repeat givers",
    definition: "Two or more paid orders.",
  },
  {
    id: "dormant",
    name: "Dormant",
    definition: "Signed up more than 60 days ago and no activity in the last 60 days.",
  },
  {
    id: "pool_only",
    name: "Pool contributors who haven't ordered",
    definition: "Has paid into a gift pool but never placed a paid catalog order.",
  },
] as const;

export type SegmentId = (typeof SEGMENTS)[number]["id"];

export function findSegment(id: string) {
  return SEGMENTS.find((segment) => segment.id === id) ?? null;
}

export interface SegmentMember {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  next_date: string | null;
}

export const SEGMENT_EXPORT_HEADERS = ["user_id", "name", "email", "phone", "city", "next_date"] as const;
