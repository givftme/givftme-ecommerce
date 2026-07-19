export type WishlistType = "evergreen" | "occasion";
export type WishlistVisibility = "private" | "friends_family" | "public";
export type WishlistItemOrigin = "external" | "catalog";
export type WishlistItemStatus = "available" | "purchased" | "archived";

export interface WishlistSummary {
  id: string;
  title: string;
  type: WishlistType;
  visibility: WishlistVisibility;
  prices_visible: boolean;
  item_count: number;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  master_item_id: string | null;
  title: string;
  image_url: string | null;
  image_storage_path?: string | null;
  product_url: string | null;
  affiliate_url: string | null;
  price: number | null;
  description: string | null;
  origin: WishlistItemOrigin;
  catalog_product_id: string | null;
  status: WishlistItemStatus;
  is_exclusive: boolean;
  sort_order: number;
  created_at: string | null;
  intent_flagged_by?: string | null;
  intent_flagged_at?: string | null;
  affiliate_purchased_at?: string | null;
  order_status?: string | null;
  buyer_name?: string | null;
}

export interface WishlistDetail {
  id: string;
  title: string;
  type: WishlistType;
  visibility: WishlistVisibility;
  prices_visible: boolean;
  items: WishlistItem[];
}

export interface WishlistInvite {
  id: string;
  wishlist_id: string;
  inviter_user_id: string | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  invitee_user_id: string | null;
  token: string;
  reminder_opted_in: boolean;
  accepted_at: string | null;
  created_at: string | null;
}

export interface SharedWishlistOwner {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SharedWishlistOccasion {
  id: string;
  title: string;
  occasion_type: string | null;
  occasion_date: string | null;
}

export interface SharedWishlist {
  id: string;
  title: string;
  visibility: WishlistVisibility;
  prices_visible: boolean;
  owner: SharedWishlistOwner;
  occasion: SharedWishlistOccasion | null;
  items: WishlistItem[];
  invite: WishlistInvite | null;
  share_id: string;
  viewer_is_owner: boolean;
}
