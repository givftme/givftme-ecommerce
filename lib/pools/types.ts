export type PoolStatus =
  | "open"
  | "fully_funded"
  | "procured"
  | "paid_out"
  | "cancelled";

export interface PoolContributor {
  id: string;
  amount: number;
  full_name: string | null;
  avatar_url: string | null;
  paid_at: string | null;
}

export interface PoolPerson {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface PoolWishlistItem {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  status: string;
}

export interface GiftPool {
  id: string;
  wishlist_id: string;
  wishlist_item_id: string | null;
  created_by: string;
  receiver_id: string;
  title: string;
  message: string | null;
  target_amount: number;
  amount_raised: number;
  min_contribution: number;
  token: string;
  status: PoolStatus;
  contributors_visible: boolean;
  fully_funded_at: string | null;
  cashed_out_at: string | null;
  cashed_out_amount: number | null;
  created_at: string;
}

export interface PoolPageData {
  pool: GiftPool;
  wishlist_title: string;
  receiver: PoolPerson;
  creator: PoolPerson;
  item: PoolWishlistItem | null;
  contributor_count: number;
  contributors: PoolContributor[] | null;
  viewer_is_manager: boolean;
  viewer_is_receiver: boolean;
  viewer_is_creator: boolean;
}

export interface DashboardPool extends GiftPool {
  wishlist_title: string;
  receiver_name: string;
  creator_name: string;
  item_title: string | null;
  item_image_url: string | null;
  contributor_count: number;
}

export function asPoolStatus(value: unknown): PoolStatus {
  switch (value) {
    case "fully_funded":
    case "procured":
    case "paid_out":
    case "cancelled":
      return value;
    default:
      return "open";
  }
}
