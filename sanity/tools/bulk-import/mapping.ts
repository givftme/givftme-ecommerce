import { formatPrice } from "@/lib/utils";
import {
  COLUMN_NAMES,
  OPTION_COLUMNS,
  PRODUCT_LEVEL_COLUMNS,
  REQUIRED_COLUMNS,
  VARIANT_ONLY_COLUMNS,
  type ColumnName,
} from "./columns";
import {
  fitSlug,
  normalizeHeader,
  parseBoolean,
  parseImageFilename,
  parseLagosDateTime,
  parseNaira,
  slugify,
  splitList,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  toPortableText,
  type Parsed,
} from "./fields";
import type {
  ImportIssue,
  ImportPlan,
  IssueSeverity,
  PlannedAttribute,
  PlannedImage,
  PlannedProduct,
  PlannedProductFields,
  PlannedVariant,
} from "./types";

// Spreadsheet rows → validated product plans. Nothing here talks to Sanity:
// checks that need the dataset (existing products, collection and supplier
// lookups) run later, against these plans.

export const MAX_ROWS = 5000;
export const MAX_PRODUCTS = 500;
export const MAX_IMAGES = 8;
export const SHORT_DESCRIPTION_LIMIT = 180;
const TITLE_MAX_LENGTH = 200;
const SKU_MAX_LENGTH = 64;
const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const STATUSES = ["draft", "active", "archived"] as const;
// The schema's initial value, which API writes don't apply on their own.
const DEFAULT_DELIVERY = "5-10 days";

interface SheetRow {
  number: number;
  values: Record<ColumnName, string>;
}

class IssueLog {
  readonly issues: ImportIssue[] = [];

  add(severity: IssueSeverity, row: number | null, column: string | null, handle: string | null, message: string) {
    this.issues.push({ severity, row, column, handle, message });
  }

  get errorCount() {
    return this.issues.filter((issue) => issue.severity === "error").length;
  }
}

/** Sanity ID for an imported product. No dots: dotted IDs aren't publicly readable. */
export function productDocumentId(handle: string) {
  return `product-${handle.toLowerCase()}`;
}

export function buildImportPlan(table: readonly (readonly string[])[]): ImportPlan {
  const log = new IssueLog();
  const fileError = (message: string) => log.add("error", null, null, null, message);
  const [header = [], ...body] = table;

  if (!header.some((cell) => cell.trim())) {
    fileError("The first row must hold the column names. Start from the template.");
    return finish(log, [], new Set(), 0);
  }

  const columnIndex = new Map<ColumnName, number>();
  header.forEach((raw, index) => {
    if (!raw.trim()) return;
    const name = normalizeHeader(raw);
    if (!isColumnName(name)) {
      log.add("warning", null, raw, null, `The "${raw}" column isn't used by the importer and will be ignored.`);
    } else if (columnIndex.has(name)) {
      fileError(`The "${name}" column appears more than once.`);
    } else {
      columnIndex.set(name, index);
    }
  });

  const missing = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column));
  if (missing.length) {
    fileError(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  }
  if (log.errorCount) return finish(log, [], new Set(), 0);

  const rows: SheetRow[] = [];
  body.forEach((cells, index) => {
    if (!cells.some((cell) => cell.trim())) return;
    const values = Object.fromEntries(
      COLUMN_NAMES.map((name) => [name, (cells[columnIndex.get(name) ?? -1] ?? "").trim()])
    ) as Record<ColumnName, string>;
    rows.push({ number: index + 2, values });
  });

  if (!rows.length) fileError("The spreadsheet has no product rows.");
  if (rows.length > MAX_ROWS) {
    fileError(`The spreadsheet has ${rows.length} rows; the limit is ${MAX_ROWS}. Split it into smaller files.`);
  }
  if (log.errorCount) return finish(log, [], new Set(), rows.length);

  const rejected = new Set<string>();
  const groups = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const handle = row.values.handle;
    if (!handle) {
      log.add("error", row.number, "handle", null, "Every row needs a handle.");
    } else if (!HANDLE_PATTERN.test(handle)) {
      log.add(
        "error",
        row.number,
        "handle",
        handle,
        "Handles use letters, numbers, hyphens or underscores, up to 80 characters."
      );
      rejected.add(handle);
    } else {
      const key = handle.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  }

  if (groups.size > MAX_PRODUCTS) {
    fileError(`The spreadsheet has ${groups.size} products; the limit is ${MAX_PRODUCTS}. Split it into smaller files.`);
    return finish(log, [], rejected, rows.length);
  }

  const built: PlannedProduct[] = [];
  for (const group of groups.values()) {
    const product = buildProduct(group, log);
    if (product) built.push(product);
    else rejected.add(group[0].values.handle);
  }

  // Slugs and SKUs must be unique across the file. The first product to use a
  // value keeps it; later ones are rejected.
  const slugOwners = new Map<string, PlannedProduct>();
  const skuOwners = new Map<string, { handle: string; row: number }>();
  const products = built.filter((product) => {
    let valid = true;
    const slug = product.fields.slug.current;
    const slugOwner = slugOwners.get(slug);
    if (slugOwner) {
      log.add(
        "error",
        product.rows[0],
        "slug",
        product.handle,
        `The slug "${slug}" is already used by ${slugOwner.handle} on row ${slugOwner.rows[0]}.`
      );
      valid = false;
    } else {
      slugOwners.set(slug, product);
    }

    for (const { sku, row } of productSkus(product)) {
      const owner = skuOwners.get(sku.toLowerCase());
      if (owner) {
        const where = owner.handle === product.handle ? `row ${owner.row}` : `${owner.handle} on row ${owner.row}`;
        log.add("error", row, "sku", product.handle, `The SKU "${sku}" is already used by ${where}.`);
        valid = false;
      } else {
        skuOwners.set(sku.toLowerCase(), { handle: product.handle, row });
      }
    }

    if (!valid) rejected.add(product.handle);
    return valid;
  });

  return finish(log, products, rejected, rows.length);
}

function buildProduct(rows: SheetRow[], log: IssueLog): PlannedProduct | null {
  const [first] = rows;
  const handle = first.values.handle;
  const errorsBefore = log.errorCount;
  const error = (row: number, column: ColumnName, message: string) =>
    log.add("error", row, column, handle, message);
  const warning = (row: number, column: ColumnName, message: string) =>
    log.add("warning", row, column, handle, message);
  const read = <T>(row: SheetRow, column: ColumnName, result: Parsed<T>): T | undefined => {
    if (result.ok) return result.value;
    error(row.number, column, result.error);
    return undefined;
  };

  for (const row of rows.slice(1)) {
    for (const column of PRODUCT_LEVEL_COLUMNS) {
      if (column === "handle") continue;
      const value = row.values[column];
      if (value && value !== first.values[column]) {
        error(
          row.number,
          column,
          `Doesn't match the product's first row (row ${first.number}). Leave it blank on variant rows or repeat the same value.`
        );
      }
    }
  }

  const isVariantProduct = rows.some((row) =>
    OPTION_COLUMNS.some((option) => row.values[option.name] || row.values[option.value])
  );

  if (!isVariantProduct && rows.length > 1) {
    for (const row of rows.slice(1)) {
      error(
        row.number,
        "handle",
        `The handle "${handle}" is already used on row ${first.number}. Give each product its own handle; only variant rows (with option values) share one.`
      );
    }
    return null;
  }

  const title = first.values.title;
  if (!title) error(first.number, "title", "A title is required.");
  else if (title.length > TITLE_MAX_LENGTH) {
    error(first.number, "title", `Keep the title under ${TITLE_MAX_LENGTH} characters.`);
  }

  const slug = resolveSlug(first, title, error, warning);

  const status = (first.values.status || "draft").toLowerCase();
  if (!isStatus(status)) error(first.number, "status", "Status must be draft, active or archived.");

  const featured = read(first, "featured", parseBoolean(first.values.featured, false));

  const shortDescription = first.values.short_description;
  if (shortDescription.length > SHORT_DESCRIPTION_LIMIT) {
    warning(
      first.number,
      "short_description",
      `This is ${shortDescription.length} characters; keep card copy under ${SHORT_DESCRIPTION_LIMIT}.`
    );
  }

  const collectionSlugs: string[] = [];
  for (const item of splitList(first.values.collections)) {
    const collectionSlug = item.toLowerCase();
    if (!SLUG_PATTERN.test(collectionSlug)) {
      error(first.number, "collections", `"${item}" isn't a collection slug. Use the slug, e.g. birthday-gifts.`);
    } else if (!collectionSlugs.includes(collectionSlug)) {
      collectionSlugs.push(collectionSlug);
    }
  }

  const images = readImages(first, title, error, warning);

  const fields: PlannedProductFields = {
    title,
    slug: { _type: "slug", current: slug ?? "" },
    status: isStatus(status) ? status : "draft",
    featured: featured ?? false,
    estimatedDeliveryDays: first.values.estimated_delivery || DEFAULT_DELIVERY,
    hasVariants: isVariantProduct,
  };
  if (shortDescription) fields.shortDescription = shortDescription;
  const description = toPortableText(first.values.description);
  if (description.length) fields.description = description;
  if (first.values.category) fields.category = first.values.category;
  const tags = [...new Set(splitList(first.values.tags))];
  if (tags.length) fields.tags = tags;
  if (first.values.supplier_product_id) fields.supplierProductId = first.values.supplier_product_id;

  const variantImages: PlannedProduct["variantImages"] = [];
  let lowestPrice: number | undefined;

  if (isVariantProduct) {
    const built = buildVariants(rows, error, warning, read);
    if (built) {
      fields.attributes = built.attributes;
      fields.variants = built.variants;
      variantImages.push(...built.variantImages);
      lowestPrice = Math.min(...built.variants.map((variant) => variant.price));
    }
  } else {
    const price = readPrice(first, "price", true, error);
    const compareAtPrice = readPrice(first, "compare_at_price", false, error);
    const sku = readSku(first, "sku", error);
    if (price !== undefined) fields.basePrice = price;
    if (compareAtPrice !== undefined) {
      fields.compareAtPrice = compareAtPrice;
      warnIfNoDiscount(first, price, compareAtPrice, warning);
    }
    if (sku) fields.baseSku = sku;
    lowestPrice = price;

    for (const column of VARIANT_ONLY_COLUMNS) {
      if (!first.values[column]) continue;
      error(
        first.number,
        column,
        column === "variant_available"
          ? "Only variants have availability. To hide a simple product, set its status to draft or archived."
          : "This column only applies to variant rows, which have option values."
      );
    }
  }

  readSale(first, isVariantProduct, lowestPrice, fields, error, read);

  if (log.errorCount > errorsBefore) return null;

  return {
    handle,
    documentId: productDocumentId(handle),
    rows: rows.map((row) => row.number),
    fields,
    collectionSlugs,
    supplierName: first.values.supplier || null,
    images,
    imageAlt: first.values.image_alt || title,
    variantImages,
  };
}

type ErrorFn = (row: number, column: ColumnName, message: string) => void;
type ReadFn = <T>(row: SheetRow, column: ColumnName, result: Parsed<T>) => T | undefined;

function resolveSlug(row: SheetRow, title: string, error: ErrorFn, warning: ErrorFn) {
  const raw = row.values.slug;

  if (!raw) {
    const slug = fitSlug(slugify(title));
    if (title && !slug) error(row.number, "slug", "Couldn't make a slug from the title. Add one in the slug column.");
    return slug || undefined;
  }

  const slug = slugify(raw);
  if (!slug) {
    error(row.number, "slug", "The slug needs letters or numbers.");
    return undefined;
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    error(row.number, "slug", `Keep the slug under ${SLUG_MAX_LENGTH} characters.`);
    return undefined;
  }
  if (slug !== raw) warning(row.number, "slug", `The slug will be saved as "${slug}".`);
  return slug;
}

function readImages(row: SheetRow, title: string, error: ErrorFn, warning: ErrorFn) {
  const filenames: string[] = [];

  for (const item of splitList(row.values.images)) {
    const parsed = parseImageFilename(item);
    if (!parsed.ok) {
      error(row.number, "images", parsed.error);
    } else if (filenames.some((filename) => filename.toLowerCase() === parsed.value.toLowerCase())) {
      warning(row.number, "images", `"${parsed.value}" is listed twice; it will be used once.`);
    } else {
      filenames.push(parsed.value);
    }
  }

  if (filenames.length > MAX_IMAGES) {
    error(row.number, "images", `${filenames.length} images are listed; a product can have up to ${MAX_IMAGES}.`);
  }
  if (!filenames.length) {
    warning(row.number, "images", "No images are listed; files named after the SKU or handle will be used if found.");
  }

  const alt = row.values.image_alt || title;
  return filenames.map<PlannedImage>((filename, index) => ({ _key: `image-${index}`, filename, alt }));
}

function readPrice(row: SheetRow, column: ColumnName, required: boolean, error: ErrorFn) {
  const raw = row.values[column];
  if (!raw) {
    if (required) error(row.number, column, "A price is required.");
    return undefined;
  }
  const parsed = parseNaira(raw);
  if (!parsed.ok) {
    error(row.number, column, parsed.error);
    return undefined;
  }
  return parsed.value;
}

function readSku(row: SheetRow, column: ColumnName, error: ErrorFn) {
  const sku = row.values[column];
  if (!sku) return undefined;
  if (/\s/.test(sku)) error(row.number, column, "SKUs can't contain spaces.");
  else if (sku.length > SKU_MAX_LENGTH) error(row.number, column, `Keep SKUs under ${SKU_MAX_LENGTH} characters.`);
  else return sku;
  return undefined;
}

function warnIfNoDiscount(row: SheetRow, price: number | undefined, compareAtPrice: number, warning: ErrorFn) {
  if (price !== undefined && compareAtPrice <= price) {
    warning(
      row.number,
      "compare_at_price",
      "The compare-at price isn't higher than the price, so no discount will show."
    );
  }
}

function buildVariants(rows: SheetRow[], error: ErrorFn, warning: ErrorFn, read: ReadFn) {
  const [first] = rows;
  let failed = false;
  const fail: ErrorFn = (row, column, message) => {
    failed = true;
    error(row, column, message);
  };

  // Option labels come from the product's first row; later rows may repeat them.
  const slots = OPTION_COLUMNS.flatMap((columns) => {
    const label = first.values[columns.name];
    return label ? [{ columns, label, name: slugify(label, "_") }] : [];
  });

  if (!slots.length) {
    fail(
      first.number,
      "option1_name",
      "Rows for this handle have option values, so the product's first row needs option names, e.g. option1_name = Size."
    );
    return null;
  }

  slots.forEach((slot, index) => {
    if (!slot.name) {
      fail(first.number, slot.columns.name, `"${slot.label}" needs letters or numbers.`);
    } else if (slots.slice(0, index).some((other) => other.name === slot.name)) {
      fail(first.number, slot.columns.name, `"${slot.label}" is already used as an option name.`);
    }
  });
  if (failed) return null;

  const attributes = slots.map<PlannedAttribute>((slot) => ({
    _type: "variantAttribute",
    _key: `attr-${slot.name}`,
    name: slot.name,
    label: slot.label,
    options: [],
  }));
  const variants: PlannedVariant[] = [];
  const variantImages: { combinationKey: string; filename: string }[] = [];
  const combinationRows = new Map<string, number>();

  rows.forEach((row, index) => {
    for (const columns of OPTION_COLUMNS) {
      const slot = slots.find((candidate) => candidate.columns === columns);
      const name = row.values[columns.name];
      const value = row.values[columns.value];
      if (!slot) {
        if (name) {
          fail(row.number, columns.name, `Set option names on the product's first row (row ${first.number}).`);
        } else if (value) {
          fail(row.number, columns.value, `${columns.value} needs ${columns.name} on the product's first row.`);
        }
      } else if (name && name.toLowerCase() !== slot.label.toLowerCase()) {
        fail(row.number, columns.name, `Doesn't match "${slot.label}" on row ${first.number}.`);
      }
    }

    const options: PlannedVariant["options"] = [];
    slots.forEach((slot, slotIndex) => {
      const raw = row.values[slot.columns.value];
      const value = slugify(raw);
      if (!raw) {
        fail(row.number, slot.columns.value, `Every variant needs a ${slot.label} value.`);
      } else if (!value) {
        fail(row.number, slot.columns.value, `"${raw}" needs letters or numbers.`);
      } else {
        const attribute = attributes[slotIndex];
        if (!attribute.options.some((option) => option.value === value)) {
          attribute.options.push({ _type: "attributeOption", _key: `option-${value}`, label: raw, value });
        }
        options.push({ _key: slot.name, attribute: slot.name, value });
      }
    });

    const price = readPrice(row, "price", true, fail);
    const compareAtPrice = readPrice(row, "compare_at_price", false, fail);
    const sku = readSku(row, "sku", fail);
    const available = read(row, "variant_available", parseBoolean(row.values.variant_available, true));
    if (available === undefined) failed = true;

    let imageFilename: string | undefined;
    if (row.values.variant_image) {
      const parsed = parseImageFilename(row.values.variant_image);
      if (parsed.ok) imageFilename = parsed.value;
      else fail(row.number, "variant_image", parsed.error);
    }

    if (options.length !== slots.length || price === undefined) return;

    const combinationKey = options.map((option) => `${option.attribute}:${option.value}`).join("|");
    const duplicateRow = combinationRows.get(combinationKey);
    if (duplicateRow) {
      fail(row.number, slots[0].columns.value, `Row ${duplicateRow} already has these options (${combinationKey}).`);
      return;
    }
    combinationRows.set(combinationKey, row.number);

    const variant: PlannedVariant = {
      _type: "productVariant",
      _key: `variant-${index}`,
      combinationKey,
      options,
      price,
      available: available ?? true,
    };
    if (compareAtPrice !== undefined) {
      variant.compareAtPrice = compareAtPrice;
      warnIfNoDiscount(row, price, compareAtPrice, warning);
    }
    if (sku) variant.sku = sku;
    if (row.values.variant_supplier_sku) variant.supplierSku = row.values.variant_supplier_sku;
    if (row.values.variant_supplier_product_id) {
      variant.supplierProductId = row.values.variant_supplier_product_id;
    }
    variants.push(variant);
    if (imageFilename) variantImages.push({ combinationKey, filename: imageFilename });
  });

  return failed ? null : { attributes, variants, variantImages };
}

function readSale(
  row: SheetRow,
  isVariantProduct: boolean,
  lowestPrice: number | undefined,
  fields: PlannedProductFields,
  error: ErrorFn,
  read: ReadFn
) {
  const columns = ["sale_price", "sale_start", "sale_end"] as const;
  if (!columns.some((column) => row.values[column])) return;

  for (const column of columns) {
    if (!row.values[column]) {
      error(row.number, column, "A flash sale needs sale_price, sale_start and sale_end.");
    }
  }

  const salePrice = row.values.sale_price ? read(row, "sale_price", parseNaira(row.values.sale_price)) : undefined;
  const start = row.values.sale_start ? read(row, "sale_start", parseLagosDateTime(row.values.sale_start)) : undefined;
  const end = row.values.sale_end
    ? read(row, "sale_end", parseLagosDateTime(row.values.sale_end, { endOfDay: true }))
    : undefined;

  if (start && end && new Date(end) <= new Date(start)) {
    error(row.number, "sale_end", "The sale must end after it starts.");
  }
  if (salePrice !== undefined && lowestPrice !== undefined && salePrice >= lowestPrice) {
    const reference = isVariantProduct ? "the lowest variant price" : "the price";
    error(row.number, "sale_price", `The sale price must be less than ${reference} (${formatPrice(lowestPrice)}).`);
  }

  if (salePrice !== undefined && start && end) {
    fields.salePrice = salePrice;
    fields.saleStartTime = start;
    fields.saleEndTime = end;
  }
}

function productSkus(product: PlannedProduct) {
  if (!product.fields.hasVariants) {
    return product.fields.baseSku ? [{ sku: product.fields.baseSku, row: product.rows[0] }] : [];
  }
  // A built variant product has exactly one variant per row, in row order.
  return (product.fields.variants ?? []).flatMap((variant, index) =>
    variant.sku ? [{ sku: variant.sku, row: product.rows[index] }] : []
  );
}

function isColumnName(name: string): name is ColumnName {
  return (COLUMN_NAMES as readonly string[]).includes(name);
}

function isStatus(status: string): status is PlannedProductFields["status"] {
  return (STATUSES as readonly string[]).includes(status);
}

function finish(log: IssueLog, products: PlannedProduct[], rejected: Set<string>, rows: number): ImportPlan {
  // Stable sort: file-level issues first, then by row.
  const issues = [...log.issues].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  const variantProducts = products.filter((product) => product.fields.hasVariants);

  return {
    products,
    rejectedHandles: [...rejected],
    issues,
    summary: {
      rows,
      products: products.length,
      simpleProducts: products.length - variantProducts.length,
      variantProducts: variantProducts.length,
      variants: variantProducts.reduce((total, product) => total + (product.fields.variants?.length ?? 0), 0),
      rejectedProducts: rejected.size,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
  };
}
