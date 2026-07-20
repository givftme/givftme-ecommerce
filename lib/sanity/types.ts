import type { TypedObject } from "@portabletext/types";

export interface SanityImageAsset {
  _key?: string;
  alt?: string | null;
  url?: string | null;
}

export interface MuseumOccasion {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  emoji?: string | null;
  occasionType?: string | null;
  coverImageUrl?: string | null;
  collectionCount: number;
  itemCount: number;
  featured?: boolean;
}

export interface MuseumCollection {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverImageUrl?: string | null;
  featured?: boolean;
  itemCount: number;
  occasion?: {
    id: string;
    title: string;
    slug: string;
    emoji?: string | null;
    occasionType?: string | null;
  } | null;
}

export interface ProductVariantOption {
  _key?: string;
  attribute: string;
  value: string;
}

export interface ProductVariant {
  _key?: string;
  combinationKey: string;
  options: ProductVariantOption[];
  price: number | null;
  compareAtPrice?: number | null;
  sku?: string | null;
  supplierSku?: string | null;
  supplierProductId?: string | null;
  available: boolean;
  imageUrl?: string | null;
}

export interface VariantAttributeOption {
  _key?: string;
  label: string;
  value: string;
  colorHex?: string | null;
}

export interface VariantAttribute {
  _key?: string;
  name: string;
  label: string;
  options: VariantAttributeOption[];
}

export interface ProductCardData {
  id: string;
  catalogProductId: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  price: number | null;
  compareAtPrice?: number | null;
  supplierProductId?: string | null;
  hasVariants?: boolean;
  createdAt?: string | null;
  occasionTypes?: string[];
  isNew?: boolean;
  isOnFlashSale?: boolean;
  saleEndTime?: string | null;
}

export interface ProductFullData extends ProductCardData {
  status?: string | null;
  description?: TypedObject[] | null;
  shortDescription?: string | null;
  images: SanityImageAsset[];
  baseSku?: string | null;
  category?: string | null;
  tags: string[];
  estimatedDeliveryDays?: string | null;
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  collections: MuseumCollection[];
}

export interface ProductReview {
  id: string;
  rating: number;
  body?: string | null;
  createdAt?: string | null;
  reviewerName?: string | null;
}

export interface RatingBreakdownRow {
  star: number;
  count: number;
  pct: number;
}

export interface ProductReviewsSummary {
  count: number;
  avg: number;
  breakdown: RatingBreakdownRow[];
  reviews: ProductReview[];
  canLeaveReview: boolean;
}
