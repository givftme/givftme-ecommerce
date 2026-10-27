import { toCsv } from "@/lib/admin/csv";
import { COLUMN_NAMES, type ColumnName } from "./columns";

export const TEMPLATE_FILENAME = "givftme-product-import-template.csv";

// One simple product and one product with two variants. Collections and
// supplier are left blank because they must name records that already exist.
const EXAMPLE_ROWS: Partial<Record<ColumnName, string>>[] = [
  {
    handle: "leather-weekend-bag",
    title: "Leather Weekend Bag",
    status: "draft",
    featured: "no",
    short_description: "Full-grain leather bag with brass fittings.",
    description: "Hand-stitched from full-grain leather.\nFits a 15-inch laptop.",
    category: "Bags",
    tags: "leather, travel",
    estimated_delivery: "5-10 days",
    price: "30000",
    compare_at_price: "35000",
    sku: "BG002",
    images: "leather-bag-front.jpg, leather-bag-side.jpg",
    image_alt: "Brown leather weekend bag",
  },
  {
    handle: "classic-sneakers",
    title: "Classic Sneakers",
    status: "draft",
    short_description: "Everyday canvas sneakers.",
    category: "Shoes",
    tags: "shoes",
    price: "45000",
    sale_price: "40000",
    sale_start: "2026-11-27 00:00",
    sale_end: "2026-11-30",
    sku: "NK001-40-WHT",
    option1_name: "Size",
    option1_value: "40",
    option2_name: "Colour",
    option2_value: "White",
    variant_available: "yes",
    variant_image: "sneakers-white.jpg",
    images: "sneakers-front.jpg",
  },
  {
    handle: "classic-sneakers",
    price: "45000",
    sku: "NK001-41-WHT",
    option1_value: "41",
    option2_value: "White",
    variant_available: "no",
    variant_image: "sneakers-white.jpg",
  },
];

export function buildTemplateCsv() {
  return toCsv(
    COLUMN_NAMES,
    EXAMPLE_ROWS.map((row) => COLUMN_NAMES.map((column) => row[column] ?? ""))
  );
}
