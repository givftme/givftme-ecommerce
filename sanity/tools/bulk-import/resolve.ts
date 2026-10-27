import { getPublishedId, type SanityClient } from "sanity";
import { BULK_IMPORT_INDEX_QUERY } from "@/lib/sanity/queries";
import type { ImageMatchResult } from "./matching";
import type { ImportIssue, ImportPlan, PlannedProduct, PlannedProductFields } from "./types";

// Checks planned products against what is already in the dataset: products
// that exist are skipped (never changed), and collection and supplier names
// are resolved to the documents they reference. Only reads; nothing here
// writes to Sanity.
//
// The rules, so the same spreadsheet and dataset always give the same answer:
// - Drafts, release versions and published documents are grouped under their
//   published ID. Any of them counts as "existing".
// - A product is blocked if its document ID exists, or if its slug or any SKU
//   (base or variant) is used by another product. Compared case-insensitively.
// - Collections are found by slug, suppliers by name (case-insensitive, runs of
//   spaces collapsed). A published document's value wins over its draft's.
//   Exactly one document must match, and it must be published.
// - A collection that isn't "active" is only a warning: products can be added
//   to it, but the storefront won't show it yet.
// - Images come from the previous step. A product is blocked only if an image
//   it needs (listed in the spreadsheet, or found by SKU) is missing or
//   ambiguous; a product with no images at all is a warning.
// When several documents clash, they're listed by ID, so messages don't depend
// on the order Sanity returns them in.

export interface SanityIndex {
  products: {
    _id: string;
    title: string | null;
    slug: string | null;
    baseSku: string | null;
    variantSkus: (string | null)[] | null;
  }[];
  collections: { _id: string; title: string | null; slug: string | null; status: string | null }[];
  suppliers: { _id: string; name: string | null }[];
}

export class LookupError extends Error {}

/**
 * One read with the editor's own session. The "raw" perspective includes
 * drafts and release versions, so an unpublished duplicate still counts.
 */
export async function fetchSanityIndex(client: SanityClient): Promise<SanityIndex> {
  try {
    const result = await client
      .withConfig({ perspective: "raw", useCdn: false })
      .fetch<Partial<SanityIndex> | null>(BULK_IMPORT_INDEX_QUERY);
    return {
      products: result?.products ?? [],
      collections: result?.collections ?? [],
      suppliers: result?.suppliers ?? [],
    };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    throw new LookupError(
      status === 401 || status === 403
        ? "Your Sanity session can't read this dataset. Log in again, or ask a project administrator for access."
        : "Couldn't reach Sanity to check existing products. Check your connection and try again."
    );
  }
}

export type SkipReason = "already-imported" | "duplicate" | "images" | "references";

/**
 * `ready` — nothing to review. `warning` — can be imported, but read the
 * warnings first. `blocked` — won't be imported until the spreadsheet,
 * images or Studio are fixed.
 */
export type ResolutionOutcome = "ready" | "warning" | "blocked";

/** The order reasons are counted in: a product blocked for several counts once, under the first. */
const SKIP_ORDER: SkipReason[] = ["already-imported", "duplicate", "images", "references"];

export interface ProductResolution {
  handle: string;
  documentId: string;
  title: string;
  rows: number[];
  status: PlannedProductFields["status"];
  outcome: ResolutionOutcome;
  skipReasons: { reason: SkipReason; message: string }[];
  warnings: string[];
  collections: { slug: string; id: string; title: string }[];
  supplier: { name: string; id: string } | null;
  /** Gallery filenames, in order; empty when the product is blocked by its images. */
  images: string[];
  variantImages: { combinationKey: string; filename: string }[];
}

export interface ResolutionResult {
  products: ProductResolution[];
  issues: ImportIssue[];
  summary: {
    /** Products that passed spreadsheet validation and were checked here. */
    checked: number;
    ready: number;
    warning: number;
    blocked: number;
    alreadyImported: number;
    duplicates: number;
    missingImages: number;
    missingReferences: number;
    /** Products rejected earlier, by spreadsheet validation. */
    rejectedInSpreadsheet: number;
    /** Importable products with status "active": shown on the storefront once published. */
    activeIfPublished: number;
    /** Distinct files the importable products use; a file shared by several is counted once. */
    uploadImages: number;
    uploadBytes: number;
    /** Of those, files used by more than one importable product. */
    sharedImages: number;
  };
}

interface Existing {
  id: string;
  title: string;
  states: Set<"published" | "draft" | "version">;
  slugs: Set<string>;
  skus: Set<string>;
}

interface Referenceable {
  id: string;
  title: string;
  published: boolean;
  /** Collection status, from the published document when there is one. */
  status: string | null;
}

const stateOf = (id: string) => (id.startsWith("drafts.") ? "draft" : id.startsWith("versions.") ? "version" : "published");
const normaliseName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function describe(existing: Existing) {
  const states = [...existing.states].map((state) => (state === "version" ? "in a release" : state));
  return `"${existing.title}" (${existing.id}, ${states.join(" and ")})`;
}

function addTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (!list) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

function indexProducts(index: SanityIndex) {
  const products = new Map<string, Existing>();
  for (const document of index.products) {
    const id = getPublishedId(document._id);
    const entry = products.get(id) ?? { id, title: "", states: new Set(), slugs: new Set(), skus: new Set() };
    const state = stateOf(document._id);
    entry.states.add(state);
    // Prefer the published title; a draft's is the fallback.
    if (document.title && (!entry.title || state === "published")) entry.title = document.title;
    if (document.slug) entry.slugs.add(document.slug.toLowerCase());
    for (const sku of [document.baseSku, ...(document.variantSkus ?? [])]) {
      if (sku) entry.skus.add(sku.toLowerCase());
    }
    products.set(id, entry);
  }

  const bySlug = new Map<string, Existing[]>();
  const bySku = new Map<string, Existing[]>();
  for (const entry of [...products.values()].sort(byId)) {
    entry.title ||= "Untitled product";
    for (const slug of entry.slugs) addTo(bySlug, slug, entry);
    for (const sku of entry.skus) addTo(bySku, sku, entry);
  }
  return { products, bySlug, bySku };
}

/**
 * Groups documents by published ID under a lookup key (collection slug or
 * supplier name). The published document's key wins over a draft's, so a
 * collection whose slug is being changed in a draft is still found by its
 * live slug.
 */
function indexReferenceable<T extends { _id: string }>(
  documents: T[],
  key: (document: T) => string | null,
  title: (document: T) => string,
  status: (document: T) => string | null = () => null
) {
  const entries = new Map<string, Referenceable & { key: string | null; keyFromPublished: boolean }>();
  for (const document of documents) {
    const id = getPublishedId(document._id);
    const published = stateOf(document._id) === "published";
    const entry = entries.get(id) ?? { id, title: "", published: false, status: null, key: null, keyFromPublished: false };
    if (published) {
      entry.published = true;
      entry.title = title(document);
      entry.status = status(document);
      entry.key = key(document);
      entry.keyFromPublished = true;
    } else if (!entry.keyFromPublished) {
      entry.title ||= title(document);
      entry.status ??= status(document);
      entry.key ??= key(document);
    }
    entries.set(id, entry);
  }

  const byKey = new Map<string, Referenceable[]>();
  for (const entry of [...entries.values()].sort(byId)) {
    if (entry.key) addTo(byKey, entry.key, entry);
  }
  return byKey;
}

/** Every SKU in a product, with the spreadsheet row it came from. */
function productSkus(product: PlannedProduct) {
  const skus = product.fields.baseSku ? [{ sku: product.fields.baseSku, row: product.rows[0] }] : [];
  (product.fields.variants ?? []).forEach((variant, index) => {
    if (variant.sku) skus.push({ sku: variant.sku, row: product.rows[index] ?? product.rows[0] });
  });
  return skus;
}

export function resolveImport(plan: ImportPlan, images: ImageMatchResult, index: SanityIndex): ResolutionResult {
  const existing = indexProducts(index);
  const collections = indexReferenceable(
    index.collections,
    (document) => document.slug?.toLowerCase() ?? null,
    (document) => document.title || "Untitled collection",
    (document) => document.status
  );
  const suppliers = indexReferenceable(
    index.suppliers,
    (document) => (document.name ? normaliseName(document.name) : null),
    (document) => document.name || "Unnamed supplier"
  );
  const imageMatches = new Map(images.products.map((match) => [match.documentId, match]));

  const issues: ImportIssue[] = [];
  const products = plan.products.map((product) => {
    const firstRow = product.rows[0];
    const report = (severity: ImportIssue["severity"], row: number, column: string, message: string) =>
      issues.push({ severity, row, column, handle: product.handle, message });

    const resolution: ProductResolution = {
      handle: product.handle,
      documentId: product.documentId,
      title: product.fields.title,
      rows: product.rows,
      status: product.fields.status,
      outcome: "ready",
      skipReasons: [],
      warnings: [],
      collections: [],
      supplier: null,
      images: [],
      variantImages: [],
    };
    const skip = (reason: SkipReason, row: number, column: string, message: string) => {
      resolution.skipReasons.push({ reason, message });
      report("error", row, column, message);
    };
    const warn = (row: number, column: string, message: string) => {
      resolution.warnings.push(message);
      report("warning", row, column, message);
    };
    const otherThan = (entries: Existing[] | undefined) => entries?.find((entry) => entry.id !== product.documentId);

    // Existing products: never changed, so any match means skip.
    const own = existing.products.get(product.documentId);
    if (own) {
      skip(
        "already-imported",
        firstRow,
        "handle",
        `Already in the Studio as ${describe(own)}, probably from an earlier import. Skipped; it won't be changed.`
      );
    }
    const slug = product.fields.slug.current.toLowerCase();
    const slugOwner = otherThan(existing.bySlug.get(slug));
    if (slugOwner) {
      skip("duplicate", firstRow, "slug", `The slug "${slug}" is already used by ${describe(slugOwner)}.`);
    }
    for (const { sku, row } of productSkus(product)) {
      const skuOwner = otherThan(existing.bySku.get(sku.toLowerCase()));
      if (skuOwner) skip("duplicate", row, "sku", `The SKU "${sku}" is already used by ${describe(skuOwner)}.`);
    }

    // References must point at published documents, or the write is refused.
    for (const collectionSlug of product.collectionSlugs) {
      const matches = collections.get(collectionSlug.toLowerCase()) ?? [];
      const [match] = matches;
      if (!match) {
        skip("references", firstRow, "collections", `No collection has the slug "${collectionSlug}". Use the slug of an existing collection.`);
      } else if (matches.length > 1) {
        skip(
          "references",
          firstRow,
          "collections",
          `${matches.length} collections have the slug "${collectionSlug}" (${matches.map((entry) => entry.id).join(", ")}). Make the slugs unique first.`
        );
      } else if (!match.published) {
        skip(
          "references",
          firstRow,
          "collections",
          `The collection "${match.title}" (${collectionSlug}) is only a draft. Publish it before importing products into it.`
        );
      } else {
        if (match.status !== "active") {
          warn(
            firstRow,
            "collections",
            `The collection "${match.title}" is ${match.status ?? "missing a status"}, so it isn't shown on the storefront yet.`
          );
        }
        resolution.collections.push({ slug: collectionSlug, id: match.id, title: match.title });
      }
    }

    if (product.supplierName) {
      const matches = suppliers.get(normaliseName(product.supplierName)) ?? [];
      const [match] = matches;
      if (!match) {
        skip(
          "references",
          firstRow,
          "supplier",
          `No supplier is named "${product.supplierName}". Add it in the Studio first, or leave supplier blank.`
        );
      } else if (matches.length > 1) {
        skip(
          "references",
          firstRow,
          "supplier",
          `${matches.length} suppliers are named "${product.supplierName}" (${matches.map((entry) => entry.id).join(", ")}). Rename one first.`
        );
      } else if (!match.published) {
        skip("references", firstRow, "supplier", `The supplier "${match.title}" is only a draft. Publish it first.`);
      } else {
        resolution.supplier = { name: match.title, id: match.id };
      }
    }

    // Images were checked in the previous step; only an image the product needs can block it.
    const imageMatch = imageMatches.get(product.documentId);
    if (!imageMatch || !imageMatch.ok) {
      skip("images", firstRow, "images", "Some of its images are missing or ambiguous; see Choose images.");
    } else {
      resolution.images = imageMatch.gallery.flatMap((slot) => (slot.image ? [slot.image.filename] : []));
      resolution.variantImages = imageMatch.variantImages.flatMap((slot) =>
        slot.image ? [{ combinationKey: slot.combinationKey, filename: slot.image.filename }] : []
      );
      if (!resolution.images.length) warn(firstRow, "images", "It has no gallery images, so it will show without a photo.");
    }

    resolution.outcome = resolution.skipReasons.length ? "blocked" : resolution.warnings.length ? "warning" : "ready";
    return resolution;
  });

  const importable = products.filter((product) => product.outcome !== "blocked");
  const blocked = products.filter((product) => product.outcome === "blocked");
  const primary = (product: ProductResolution) =>
    SKIP_ORDER.find((reason) => product.skipReasons.some((entry) => entry.reason === reason));

  // The same file used by several products is uploaded once.
  const uploads = new Map<string, { size: number; users: Set<string> }>();
  for (const product of importable) {
    const match = imageMatches.get(product.documentId);
    for (const slot of [...(match?.gallery ?? []), ...(match?.variantImages ?? [])]) {
      if (!slot.image) continue;
      const upload = uploads.get(slot.image.key) ?? { size: slot.image.size, users: new Set() };
      upload.users.add(product.documentId);
      uploads.set(slot.image.key, upload);
    }
  }

  return {
    products,
    issues: issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0)),
    summary: {
      checked: products.length,
      ready: products.filter((product) => product.outcome === "ready").length,
      warning: products.filter((product) => product.outcome === "warning").length,
      blocked: blocked.length,
      alreadyImported: blocked.filter((product) => primary(product) === "already-imported").length,
      duplicates: blocked.filter((product) => primary(product) === "duplicate").length,
      missingImages: blocked.filter((product) => primary(product) === "images").length,
      missingReferences: blocked.filter((product) => primary(product) === "references").length,
      rejectedInSpreadsheet: plan.rejectedHandles.length,
      activeIfPublished: importable.filter((product) => product.status === "active").length,
      uploadImages: uploads.size,
      uploadBytes: [...uploads.values()].reduce((total, upload) => total + upload.size, 0),
      sharedImages: [...uploads.values()].filter((upload) => upload.users.size > 1).length,
    },
  };
}
