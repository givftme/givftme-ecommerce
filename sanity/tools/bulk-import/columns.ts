// The spreadsheet columns the importer reads, in template order. One row is
// one simple product, or one variant of a product; variant rows share a
// handle. `product` columns are read from a product's first row (later rows
// may repeat them or leave them blank); `row` columns are read from every row.

export const IMPORT_COLUMNS = [
  {
    name: "handle",
    level: "product",
    required: true,
    description:
      "Stable ID for the product. Letters, numbers, hyphens or underscores. Rows sharing a handle are variants of one product. In Excel, format this column as Text so values like 00123 keep their leading zeros.",
  },
  { name: "title", level: "product", required: true, description: "Product name." },
  {
    name: "slug",
    level: "product",
    required: false,
    description: "URL slug. Made from the title when blank.",
  },
  {
    name: "status",
    level: "product",
    required: false,
    description: "draft, active or archived. Defaults to draft. Only active products show on the storefront.",
  },
  { name: "featured", level: "product", required: false, description: "yes or no. Defaults to no." },
  {
    name: "short_description",
    level: "product",
    required: false,
    description: "Card copy. Keep it under 180 characters.",
  },
  {
    name: "description",
    level: "product",
    required: false,
    description: "Plain text. Each line becomes a paragraph.",
  },
  { name: "category", level: "product", required: false, description: "Free-text category, e.g. Bags." },
  { name: "tags", level: "product", required: false, description: "Comma-separated tags." },
  {
    name: "collections",
    level: "product",
    required: false,
    description: "Comma-separated slugs of collections that already exist in the Studio.",
  },
  {
    name: "supplier",
    level: "product",
    required: false,
    description: "Name of a supplier that already exists in the Studio.",
  },
  { name: "supplier_product_id", level: "product", required: false, description: "Supplier's product ID." },
  {
    name: "estimated_delivery",
    level: "product",
    required: false,
    description: "Delivery estimate. Defaults to 5-10 days.",
  },
  {
    name: "price",
    level: "row",
    required: true,
    description: "Whole naira, e.g. 45000. The product price, or this variant's price on variant rows.",
  },
  {
    name: "compare_at_price",
    level: "row",
    required: false,
    description: "Optional original price shown struck through. Whole naira.",
  },
  {
    name: "sale_price",
    level: "product",
    required: false,
    description: "Flash sale price in whole naira. Needs sale_start and sale_end.",
  },
  {
    name: "sale_start",
    level: "product",
    required: false,
    description: "YYYY-MM-DD HH:mm, Lagos time.",
  },
  {
    name: "sale_end",
    level: "product",
    required: false,
    description: "YYYY-MM-DD HH:mm, Lagos time. A date alone means the end of that day.",
  },
  {
    name: "sku",
    level: "row",
    required: false,
    description:
      "Product SKU, or this variant's SKU on variant rows. Must be unique in the file. In Excel, format this column as Text so values like 00123 keep their leading zeros.",
  },
  {
    name: "option1_name",
    level: "row",
    required: false,
    description: "Option label, e.g. Size. Set it on the product's first row; later rows may leave it blank.",
  },
  { name: "option1_value", level: "row", required: false, description: "This variant's value, e.g. Medium." },
  { name: "option2_name", level: "row", required: false, description: "Second option label, e.g. Colour." },
  { name: "option2_value", level: "row", required: false, description: "This variant's second value." },
  { name: "option3_name", level: "row", required: false, description: "Third option label." },
  { name: "option3_value", level: "row", required: false, description: "This variant's third value." },
  {
    name: "variant_supplier_sku",
    level: "row",
    required: false,
    description: "Supplier's SKU for this variant.",
  },
  {
    name: "variant_supplier_product_id",
    level: "row",
    required: false,
    description: "Supplier's product ID for this variant.",
  },
  {
    name: "variant_available",
    level: "row",
    required: false,
    description: "yes or no. Defaults to yes. Unavailable variants show as sold out.",
  },
  {
    name: "variant_image",
    level: "row",
    required: false,
    description: "One image filename for this variant.",
  },
  {
    name: "images",
    level: "product",
    required: false,
    description: "Comma-separated image filenames, up to 8. The first is the card image.",
  },
  {
    name: "image_alt",
    level: "product",
    required: false,
    description: "Alt text for the product images. Defaults to the title.",
  },
] as const satisfies readonly {
  name: string;
  level: "product" | "row";
  required: boolean;
  description: string;
}[];

export type ColumnName = (typeof IMPORT_COLUMNS)[number]["name"];

export const COLUMN_NAMES: readonly ColumnName[] = IMPORT_COLUMNS.map((column) => column.name);

export const REQUIRED_COLUMNS: readonly ColumnName[] = IMPORT_COLUMNS.filter(
  (column) => column.required
).map((column) => column.name);

export const PRODUCT_LEVEL_COLUMNS: readonly ColumnName[] = IMPORT_COLUMNS.filter(
  (column) => column.level === "product"
).map((column) => column.name);

/** Columns that only make sense on a variant row. */
export const VARIANT_ONLY_COLUMNS: readonly ColumnName[] = [
  "variant_supplier_sku",
  "variant_supplier_product_id",
  "variant_available",
  "variant_image",
];

export const OPTION_COLUMNS = [
  { name: "option1_name", value: "option1_value" },
  { name: "option2_name", value: "option2_value" },
  { name: "option3_name", value: "option3_value" },
] as const satisfies readonly { name: ColumnName; value: ColumnName }[];
