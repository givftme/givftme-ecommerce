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
