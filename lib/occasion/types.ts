import type { WishlistDetail, WishlistItem, WishlistItemOrigin } from "@/lib/wishlist/types";
import type { OCCASION_TYPES } from "@/lib/occasion/constants";

export type OccasionType = (typeof OCCASION_TYPES)[number];
export type OccasionStatus = "active" | "archived";

export interface OccasionSummary {
  id: string;
  title: string;
  occasion_type: OccasionType;
  occasion_date: string;
  status: OccasionStatus;
  archived_at: string | null;
  wishlist_id: string | null;
  item_count: number;
}

export interface MasterItem {
  id: string;
  title: string;
  image_url: string | null;
  image_storage_path?: string | null;
  product_url: string | null;
  price: number | null;
  origin: WishlistItemOrigin;
  catalog_product_id: string | null;
  status: string | null;
  sort_order: number;
}

export interface OccasionRecord {
  id: string;
  title: string;
  occasion_type: OccasionType;
  occasion_date: string;
  status: OccasionStatus;
  archived_at: string | null;
}

export interface OccasionDetail {
  occasion: OccasionRecord;
  wishlist: WishlistDetail;
  evergreenItems: MasterItem[];
  reactivationItems: WishlistItem[];
}

export interface OccasionPromptSummary {
  id: string;
  occasion_id: string;
  occasion_title: string;
  occasion_type: OccasionType;
  item_count: number;
}
