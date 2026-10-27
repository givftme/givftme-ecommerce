import { getPublishedId, type SanityClient } from "sanity";
import { BULK_IMPORT_INDEX_QUERY } from "@/lib/sanity/queries";
import type { ImageMatchResult } from "./matching";
import type { ImportIssue, ImportPlan, PlannedProduct, PlannedProductFields } from "./types";

// Checks planned products against what is already in the dataset: products
// that exist are skipped (never changed), and collection and supplier names
// are resolved to the documents they reference. Only reads; nothing here
// writes to Sanity.

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

/** The order reasons are counted in: a product skipped for several counts once, under the first. */
const SKIP_ORDER: SkipReason[] = ["already-imported", "duplicate", "images", "references"];

export interface ProductResolution {
  handle: string;
  documentId: string;
  title: string;
  rows: number[];
  status: PlannedProductFields["status"];
  ready: boolean;
  skipReasons: { reason: SkipReason; message: string }[];
  warnings: string[];
  collections: { slug: string; id: string; title: string }[];
  supplier: { name: string; id: string } | null;
  images: number;
  variantImages: number;
}

export interface ResolutionResult {
  products: ProductResolution[];
  issues: ImportIssue[];
  summary: {
    /** Products that passed spreadsheet validation and were checked here. */
    checked: number;
    ready: number;
    skipped: number;
    alreadyImported: number;
    duplicates: number;
    missingImages: number;
    missingReferences: number;
    /** Products rejected earlier, by spreadsheet validation. */
    rejectedInSpreadsheet: number;
    /** Ready products with status "active": shown on the storefront once published. */
    activeIfPublished: number;
    uploadImages: number;
    uploadBytes: number;
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

function describe(existing: Existing) {
  const states = [...existing.states].map((state) => (state === "version" ? "in a release" : state));
  return `"${existing.title}" (${existing.id}, ${states.join(" and ")})`;
}

function indexProducts(index: SanityIndex) {
  const byId = new Map<string, Existing>();
  for (const document of index.products) {
    const id = getPublishedId(document._id);
    const entry = byId.get(id) ?? { id, title: "", states: new Set(), slugs: new Set(), skus: new Set() };
    const state = stateOf(document._id);
    entry.states.add(state);
    // Prefer the published title; a draft's is the fallback.
    if (document.title && (!entry.title || state === "published")) entry.title = document.title;
    if (document.slug) entry.slugs.add(document.slug.toLowerCase());
    for (const sku of [document.baseSku, ...(document.variantSkus ?? [])]) {
      if (sku) entry.skus.add(sku.toLowerCase());
    }
    byId.set(id, entry);
  }
  for (const entry of byId.values()) entry.title ||= "Untitled product";
  return byId;
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
  const byId = new Map<string, Referenceable & { key: string | null; keyFromPublished: boolean }>();
  for (const document of documents) {
    const id = getPublishedId(document._id);
    const published = stateOf(document._id) === "published";
    const entry = byId.get(id) ?? { id, title: "", published: false, status: null, key: null, keyFromPublished: false };
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
    byId.set(id, entry);
  }

  const byKey = new Map<string, Referenceable[]>();
  for (const entry of byId.values()) {
    if (!entry.key) continue;
    byKey.set(entry.key, [...(byKey.get(entry.key) ?? []), entry]);
  }
  return byKey;
}

/** Every SKU in a product, with the spreadsheet row it came from. */
function productSkus(product: PlannedProduct) {
  if (!product.fields.hasVariants) {
    return product.fields.baseSku ? [{ sku: product.fields.baseSku, row: product.rows[0] }] : [];
  }
  return (product.fields.variants ?? []).flatMap((variant, index) =>
    variant.sku ? [{ sku: variant.sku, row: product.rows[index] }] : []
  );
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
      ready: false,
      skipReasons: [],
      warnings: [],
      collections: [],
      supplier: null,
      images: 0,
      variantImages: 0,
    };
    const skip = (reason: SkipReason, row: number, column: string, message: string) => {
      resolution.skipReasons.push({ reason, message });
      // A re-run finding its own earlier import is expected, not a mistake.
      report(reason === "already-imported" ? "warning" : "error", row, column, message);
    };
    const warn = (row: number, column: string, message: string) => {
      resolution.warnings.push(message);
      report("warning", row, column, message);
    };

    // Existing products: never changed, so any match means skip.
    const own = existing.get(product.documentId);
    if (own) {
      skip(
        "already-imported",
        firstRow,
        "handle",
        `Already in the Studio as ${describe(own)}, probably from an earlier import. Skipped; it won't be changed.`
      );
    }
    const others = [...existing.values()].filter((entry) => entry.id !== product.documentId);
    const slug = product.fields.slug.current;
    const slugOwner = others.find((entry) => entry.slugs.has(slug));
    if (slugOwner) {
      skip("duplicate", firstRow, "slug", `The slug "${slug}" is already used by ${describe(slugOwner)}.`);
    }
    for (const { sku, row } of productSkus(product)) {
      const skuOwner = others.find((entry) => entry.skus.has(sku.toLowerCase()));
      if (skuOwner) skip("duplicate", row, "sku", `The SKU "${sku}" is already used by ${describe(skuOwner)}.`);
    }

    // References must point at published documents, or the write is refused.
    for (const collectionSlug of product.collectionSlugs) {
      const matches = collections.get(collectionSlug) ?? [];
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

    // Images were checked in the previous step; a product missing a listed image is skipped.
    const imageMatch = imageMatches.get(product.documentId);
    if (!imageMatch || !imageMatch.ok) {
      skip("images", firstRow, "images", "Some of its listed images are missing or ambiguous; see Choose images.");
    } else {
      resolution.images = imageMatch.gallery.length;
      resolution.variantImages = imageMatch.variantImages.length;
      if (!imageMatch.gallery.length) warn(firstRow, "images", "It has no gallery images, so it will show without a photo.");
    }

    resolution.ready = resolution.skipReasons.length === 0;
    return resolution;
  });

  const ready = products.filter((product) => product.ready);
  const skipped = products.filter((product) => !product.ready);
  const primary = (product: ProductResolution) =>
    SKIP_ORDER.find((reason) => product.skipReasons.some((entry) => entry.reason === reason));

  // The same file used by several products is uploaded once.
  const uploads = new Map<string, number>();
  for (const product of ready) {
    const match = imageMatches.get(product.documentId);
    for (const slot of [...(match?.gallery ?? []), ...(match?.variantImages ?? [])]) {
      if (slot.image) uploads.set(slot.image.key, slot.image.size);
    }
  }

  return {
    products,
    issues: issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0)),
    summary: {
      checked: products.length,
      ready: ready.length,
      skipped: skipped.length,
      alreadyImported: skipped.filter((product) => primary(product) === "already-imported").length,
      duplicates: skipped.filter((product) => primary(product) === "duplicate").length,
      missingImages: skipped.filter((product) => primary(product) === "images").length,
      missingReferences: skipped.filter((product) => primary(product) === "references").length,
      rejectedInSpreadsheet: plan.rejectedHandles.length,
      activeIfPublished: ready.filter((product) => product.status === "active").length,
      uploadImages: uploads.size,
      uploadBytes: [...uploads.values()].reduce((total, size) => total + size, 0),
    },
  };
}
