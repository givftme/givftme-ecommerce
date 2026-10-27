import { IMAGE_EXTENSIONS } from "./fields";
import type { ImageLibrary, LocalImage } from "./images";
import { MAX_IMAGES } from "./mapping";
import type { ImportIssue, ImportPlan, PlannedProduct } from "./types";

// Pairs each planned product with the local files for its gallery and
// variant images. Files are matched by the filenames in the spreadsheet; when
// a product lists none, files named after its SKU (or handle) are used:
//   nk001.jpg      → image 1
//   nk001-2.jpg    → image 2 (also nk001_2.jpg, nk001-02.jpg), up to 8
// A variant with no variant_image uses a file named exactly after its SKU.

export type SlotStatus = "matched" | "missing" | "conflict" | "rejected";

export interface ImageSlot {
  filename: string;
  status: SlotStatus;
  image: LocalImage | null;
  /** Why the slot isn't matched, for display. */
  reason: string | null;
  via: "spreadsheet" | "sku";
}

export interface GallerySlot extends ImageSlot {
  _key: string;
  alt: string;
}

export interface VariantSlot extends ImageSlot {
  combinationKey: string;
}

export interface ProductImageMatch {
  handle: string;
  documentId: string;
  title: string;
  gallery: GallerySlot[];
  variantImages: VariantSlot[];
  /** SKU or handle used for the fallback, when the spreadsheet listed no images. */
  fallbackId: string | null;
  /** False when a listed image is missing or ambiguous; the product can't be imported as is. */
  ok: boolean;
}

export interface ImageMatchResult {
  products: ProductImageMatch[];
  issues: ImportIssue[];
  /** Usable images no product uses; usually a typo in the spreadsheet. */
  unused: LocalImage[];
  summary: {
    products: number;
    productsReady: number;
    productsBlocked: number;
    productsWithoutImages: number;
    matched: number;
    matchedBySku: number;
    unmatched: number;
    unused: number;
  };
}

const FALLBACK_SUFFIX = /^[-_]0?([1-8])$/;

function stemOf(key: string) {
  const dot = key.lastIndexOf(".");
  return dot > 0 ? key.slice(0, dot) : key;
}

function hasImageExtension(key: string) {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(key.slice(key.lastIndexOf(".") + 1));
}

/** Looks one filename up, explaining any failure in words the editor can act on. */
function lookup(library: ImageLibrary, filename: string, via: ImageSlot["via"]): ImageSlot {
  const key = filename.toLowerCase();
  const conflict = library.conflicts.get(key);
  if (conflict) {
    return {
      filename,
      status: "conflict",
      image: null,
      reason: `More than one different file is named ${filename} (${conflict.join(", ")}). Rename one.`,
      via,
    };
  }

  const image = library.images.get(key);
  if (image) return { filename, status: "matched", image, reason: null, via };

  const rejected = library.rejected.get(key);
  if (rejected) return { filename, status: "rejected", image: null, reason: rejected, via };

  const stem = stemOf(key);
  const nearMiss = [...library.images.values()].find((candidate) => stemOf(candidate.key) === stem);
  return {
    filename,
    status: "missing",
    image: null,
    reason: nearMiss
      ? `${filename} wasn't among the chosen images. Did you mean ${nearMiss.filename}?`
      : `${filename} wasn't among the chosen images.`,
    via,
  };
}

/** Every SKU and handle in the plan; a file named exactly after one belongs to that item. */
function exactIdentifiers(plan: ImportPlan) {
  const ids = new Set<string>();
  for (const product of plan.products) {
    ids.add(product.handle.toLowerCase());
    if (product.fields.baseSku) ids.add(product.fields.baseSku.toLowerCase());
    for (const variant of product.fields.variants ?? []) {
      if (variant.sku) ids.add(variant.sku.toLowerCase());
    }
  }
  return ids;
}

/** Files named after one ID, keyed by gallery position (0 = the bare name). */
function filesNamedAfter(library: ImageLibrary, id: string, exactIds: Set<string>) {
  const target = id.toLowerCase();
  const positions = new Map<number, string[]>();
  const keys = [...library.images.keys(), ...library.conflicts.keys(), ...library.rejected.keys()];

  for (const key of keys) {
    if (!hasImageExtension(key)) continue;
    const stem = stemOf(key);
    let position: number | null = null;
    if (stem === target) {
      position = 0;
    } else if (stem.startsWith(target) && !exactIds.has(stem)) {
      const match = FALLBACK_SUFFIX.exec(stem.slice(target.length));
      if (match) position = Number(match[1]);
    }
    if (position !== null) positions.set(position, [...(positions.get(position) ?? []), key]);
  }
  return positions;
}

export function matchImages(plan: ImportPlan, library: ImageLibrary): ImageMatchResult {
  const issues: ImportIssue[] = [];
  const used = new Set<string>();
  const exactIds = exactIdentifiers(plan);

  const products = plan.products.map((product) => {
    const match = matchProduct(product, library, exactIds, issues);
    for (const slot of [...match.gallery, ...match.variantImages]) {
      if (slot.image) used.add(slot.image.key);
    }
    return match;
  });

  const unused = [...library.images.values()].filter((image) => !used.has(image.key));
  if (unused.length) {
    const names = unused.map((image) => image.filename);
    issues.push({
      severity: "warning",
      row: null,
      column: "images",
      handle: null,
      message: `${unused.length} chosen image${unused.length === 1 ? " isn't" : "s aren't"} used by any product: ${
        names.length > 8 ? `${names.slice(0, 8).join(", ")} and ${names.length - 8} more` : names.join(", ")
      }. Check the filenames in the spreadsheet.`,
    });
  }

  const slots = products.flatMap((product) => [...product.gallery, ...product.variantImages]);
  const matched = slots.filter((slot) => slot.status === "matched");

  return {
    products,
    issues: issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0)),
    unused,
    summary: {
      products: products.length,
      productsReady: products.filter((product) => product.ok).length,
      productsBlocked: products.filter((product) => !product.ok).length,
      productsWithoutImages: products.filter((product) => product.gallery.length === 0).length,
      matched: matched.length,
      matchedBySku: matched.filter((slot) => slot.via === "sku").length,
      unmatched: slots.length - matched.length,
      unused: unused.length,
    },
  };
}

function matchProduct(
  product: PlannedProduct,
  library: ImageLibrary,
  exactIds: Set<string>,
  issues: ImportIssue[]
): ProductImageMatch {
  const firstRow = product.rows[0];
  const report = (severity: ImportIssue["severity"], row: number, column: string, message: string) =>
    issues.push({ severity, row, column, handle: product.handle, message });

  let gallery: GallerySlot[];
  let fallbackId: string | null = null;

  if (product.images.length) {
    gallery = product.images.map((planned) => ({
      ...lookup(library, planned.filename, "spreadsheet"),
      _key: planned._key,
      alt: planned.alt,
    }));
  } else {
    fallbackId = product.fields.baseSku ?? product.handle;
    gallery = fallbackGallery(product, fallbackId, library, exactIds, report);
  }

  for (const slot of gallery) {
    if (slot.status !== "matched" && slot.reason) report("error", firstRow, "images", slot.reason);
  }

  const variantImages: VariantSlot[] = [];
  (product.fields.variants ?? []).forEach((variant, index) => {
    const row = product.rows[index];
    const listed = product.variantImages.find((entry) => entry.combinationKey === variant.combinationKey);

    if (listed) {
      const slot = { ...lookup(library, listed.filename, "spreadsheet"), combinationKey: variant.combinationKey };
      if (slot.status !== "matched" && slot.reason) report("error", row, "variant_image", slot.reason);
      variantImages.push(slot);
      return;
    }
    if (!variant.sku) return;

    // Only a file named exactly after the variant's SKU; a variant image is optional.
    const exact = filesNamedAfter(library, variant.sku, exactIds).get(0) ?? [];
    if (exact.length > 1) {
      report(
        "error",
        row,
        "variant_image",
        `Several files are named after SKU ${variant.sku} (${exact.join(", ")}). Keep one, or name it in variant_image.`
      );
      variantImages.push({
        filename: exact[0],
        status: "conflict",
        image: null,
        reason: "Several files match this SKU.",
        via: "sku",
        combinationKey: variant.combinationKey,
      });
    } else if (exact.length === 1) {
      const slot = { ...lookup(library, exact[0], "sku"), combinationKey: variant.combinationKey };
      if (slot.status !== "matched" && slot.reason) report("error", row, "variant_image", slot.reason);
      variantImages.push(slot);
    }
  });

  const ok = [...gallery, ...variantImages].every((slot) => slot.status === "matched");
  return {
    handle: product.handle,
    documentId: product.documentId,
    title: product.fields.title,
    gallery,
    variantImages,
    fallbackId,
    ok,
  };
}

function fallbackGallery(
  product: PlannedProduct,
  id: string,
  library: ImageLibrary,
  exactIds: Set<string>,
  report: (severity: ImportIssue["severity"], row: number, column: string, message: string) => void
): GallerySlot[] {
  const row = product.rows[0];
  const positions = filesNamedAfter(library, id, exactIds);
  const ordered = [...positions.entries()].sort(([a], [b]) => a - b);
  const gallery: GallerySlot[] = [];

  for (const [position, keys] of ordered) {
    if (gallery.length >= MAX_IMAGES) {
      report(
        "warning",
        row,
        "images",
        `More than ${MAX_IMAGES} files are named after ${id}; only the first ${MAX_IMAGES} are used.`
      );
      break;
    }

    const base = { _key: `image-${gallery.length}`, alt: product.imageAlt };
    if (keys.length > 1) {
      gallery.push({
        ...base,
        filename: keys[0],
        status: "conflict",
        image: null,
        reason: `${keys.join(" and ")} could both be image ${position || 1} for ${id}. Keep one, or list the images in the spreadsheet.`,
        via: "sku",
      });
    } else {
      gallery.push({ ...base, ...lookup(library, keys[0], "sku") });
    }
  }

  if (!gallery.length) {
    report("warning", row, "images", `No images are listed, and none of the chosen files are named after ${id}.`);
  }
  return gallery;
}
