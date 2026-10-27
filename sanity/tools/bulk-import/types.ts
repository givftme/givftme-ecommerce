import type { ColumnName } from "./columns";

export type IssueSeverity = "error" | "warning";

export interface ImportIssue {
  severity: IssueSeverity;
  /** Row number as the spreadsheet app shows it (the header is row 1); null for file-level issues. */
  row: number | null;
  column: ColumnName | string | null;
  handle: string | null;
  message: string;
}

export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal";
  markDefs: never[];
  children: { _type: "span"; _key: string; text: string; marks: string[] }[];
}

export interface PlannedAttribute {
  _type: "variantAttribute";
  _key: string;
  name: string;
  label: string;
  options: { _type: "attributeOption"; _key: string; label: string; value: string }[];
}

export interface PlannedVariant {
  _type: "productVariant";
  _key: string;
  combinationKey: string;
  options: { _key: string; attribute: string; value: string }[];
  price: number;
  compareAtPrice?: number;
  sku?: string;
  supplierSku?: string;
  supplierProductId?: string;
  available: boolean;
}

/**
 * Product fields written to the Sanity document as they are. Every key is a
 * field of `sanity/schemaTypes/product.ts`; references and images are kept
 * outside so they can be resolved and uploaded before anything is written.
 */
export interface PlannedProductFields {
  title: string;
  slug: { _type: "slug"; current: string };
  status: "draft" | "active" | "archived";
  featured: boolean;
  shortDescription?: string;
  description?: PortableTextBlock[];
  category?: string;
  tags?: string[];
  supplierProductId?: string;
  estimatedDeliveryDays: string;
  hasVariants: boolean;
  basePrice?: number;
  compareAtPrice?: number;
  baseSku?: string;
  attributes?: PlannedAttribute[];
  variants?: PlannedVariant[];
  salePrice?: number;
  saleStartTime?: string;
  saleEndTime?: string;
}

export interface PlannedImage {
  _key: string;
  /** Filename as written in the spreadsheet, without any folder. */
  filename: string;
  alt: string;
}

export interface PlannedProduct {
  /** Handle as written in the spreadsheet. */
  handle: string;
  /** Sanity document ID the product will be created under. */
  documentId: string;
  /** Spreadsheet rows this product was built from. */
  rows: number[];
  fields: PlannedProductFields;
  /** Collection slugs, resolved to references before writing. */
  collectionSlugs: string[];
  /** Supplier name, resolved to a reference before writing. */
  supplierName: string | null;
  images: PlannedImage[];
  /** Alt text for the gallery, including images found by the SKU fallback. */
  imageAlt: string;
  variantImages: { combinationKey: string; filename: string }[];
}

export interface ImportSummary {
  rows: number;
  products: number;
  simpleProducts: number;
  variantProducts: number;
  variants: number;
  rejectedProducts: number;
  errors: number;
  warnings: number;
}

export interface ImportPlan {
  /** Products that passed validation, in spreadsheet order. */
  products: PlannedProduct[];
  /** Handles of products that failed validation. */
  rejectedHandles: string[];
  issues: ImportIssue[];
  summary: ImportSummary;
}
