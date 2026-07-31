import type { OccasionType } from "@/lib/occasion/types";

export interface ImportantDate {
  id: string;
  person_name: string;
  occasion_type: OccasionType;
  date: string;
  is_recurring: boolean;
  linked_wishlist_id: string | null;
  created_at: string;
}
