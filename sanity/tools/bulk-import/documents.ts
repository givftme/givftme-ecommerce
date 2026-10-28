import type { LocalImage } from "./images";
import type { ProductImageMatch } from "./matching";
import type { ProductResolution } from "./resolve";
import type { PlannedProduct } from "./types";

// Builds the draft document for one planned product. Field values, `_key`s
// and variant combination keys are copied from the plan as they are; only
// references and image assets are added. The ID is always a draft ID: this
// module can't build a published document.

/** Fields of `sanity/schemaTypes/product.ts`; documents.test.ts keeps the two in step. */
export const PRODUCT_FIELDS = [
  "title",
  "slug",
  "status",
  "featured",
  "shortDescription",
  "description",
  "images",
  "supplier",
  "collections",
  "category",
  "tags",
  "supplierProductId",
  "estimatedDeliveryDays",
  "hasVariants",
  "basePrice",
  "compareAtPrice",
  "baseSku",
  "attributes",
  "variants",
  "salePrice",
  "saleStartTime",
  "saleEndTime",
] as const;

/** Fields of `sanity/schemaTypes/productVariant.ts`. */
export const VARIANT_FIELDS = [
  "combinationKey",
  "options",
  "price",
  "compareAtPrice",
  "sku",
  "supplierSku",
  "supplierProductId",
  "available",
  "image",
] as const;

const SYSTEM_FIELDS = ["_id", "_type"];
const OBJECT_FIELDS = ["_type", "_key"];

export class DocumentBuildError extends Error {}

/** The shape of the IDs Sanity gives uploaded images: image-<hash>-<width>x<height>-<format>. */
const IMAGE_ASSET_ID = /^image-[A-Za-z0-9]+-\d+x\d+-[a-z0-9]+$/;
export const isImageAssetId = (id: unknown): id is string => typeof id === "string" && IMAGE_ASSET_ID.test(id);

/** Stands in for an image not uploaded yet, when a draft is only being checked. Never written. */
export const PLACEHOLDER_ASSET_ID = `image-${"0".repeat(40)}-1x1-png`;

export interface DraftProductDocument {
  _id: `drafts.${string}`;
  _type: "product";
  [field: string]: unknown;
}

export function draftIdFor(documentId: string): `drafts.${string}` {
  // Handles can't contain dots, so this is always a plain published ID.
  if (!documentId || documentId.includes(".")) throw new DocumentBuildError(`"${documentId}" isn't a valid product ID.`);
  return `drafts.${documentId}`;
}

/** The same content under its published ID, as publishing the draft would leave it. */
export function asPublished(document: DraftProductDocument) {
  return { ...document, _id: document._id.slice("drafts.".length) };
}

const reference = (id: string) => ({ _type: "reference", _ref: id });
const imageOf = (assetId: string) => ({ _type: "image", asset: reference(assetId) });

/** Undefined values are dropped, exactly as they are when the document is sent. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * `assetFor` gives the uploaded asset for each local image. Without it the
 * document is built without images, to check permissions and the schema
 * before anything is uploaded.
 */
export function buildDraftDocument(
  product: PlannedProduct,
  resolution: Pick<ProductResolution, "documentId" | "collections" | "supplier">,
  images: ProductImageMatch | null,
  assetFor: ((image: LocalImage) => string | undefined) | null
): DraftProductDocument {
  if (resolution.documentId !== product.documentId) {
    throw new DocumentBuildError(`The check for ${resolution.documentId} doesn't belong to ${product.documentId}.`);
  }
  const assetOf = (image: LocalImage | null, filename: string) => {
    const assetId = image && assetFor?.(image);
    if (!assetId) throw new DocumentBuildError(`${filename} hasn't been uploaded, so ${product.handle} can't be created.`);
    if (!isImageAssetId(assetId)) {
      throw new DocumentBuildError(`${filename} has an asset ID that isn't an image's (${assetId}), so ${product.handle} can't be created.`);
    }
    return assetId;
  };

  const { variants, ...fields } = product.fields;
  const document: Record<string, unknown> = { _id: draftIdFor(product.documentId), _type: "product", ...fields };

  if (resolution.supplier) document.supplier = reference(resolution.supplier.id);
  if (resolution.collections.length) {
    document.collections = resolution.collections.map((collection, index) => ({
      ...reference(collection.id),
      _key: `collection-${index}`,
    }));
  }

  if (assetFor && images?.gallery.length) {
    document.images = images.gallery.map((slot) => ({
      ...imageOf(assetOf(slot.image, slot.filename)),
      _key: slot._key,
      ...(slot.alt ? { alt: slot.alt } : {}),
    }));
  }

  if (variants) {
    document.variants = variants.map((variant) => {
      const slot = images?.variantImages.find((entry) => entry.combinationKey === variant.combinationKey);
      return assetFor && slot ? { ...variant, image: imageOf(assetOf(slot.image, slot.filename)) } : { ...variant };
    });
  }

  const built = plain(document) as DraftProductDocument;
  const unknown = Object.keys(built).filter(
    (key) => !SYSTEM_FIELDS.includes(key) && !(PRODUCT_FIELDS as readonly string[]).includes(key)
  );
  for (const variant of (built.variants as Record<string, unknown>[] | undefined) ?? []) {
    unknown.push(
      ...Object.keys(variant).filter(
        (key) => !OBJECT_FIELDS.includes(key) && !(VARIANT_FIELDS as readonly string[]).includes(key)
      ).map((key) => `variants.${key}`)
    );
  }
  if (unknown.length) throw new DocumentBuildError(`Fields the product schema doesn't have: ${unknown.join(", ")}.`);
  return built;
}

/**
 * Whether a draft read back after an unclear create is the one that was sent.
 * Every value the importer wrote must be there, unchanged and in order.
 * Anything else on the stored document is ignored: Sanity adds `_rev`,
 * `_createdAt` and `_updatedAt`, and a later edit may add fields. A changed
 * or missing value means it isn't ours.
 */
export function matchesAttempt(existing: unknown, attempted: { _id: string; _type: string }) {
  return holds(existing, attempted);
}

/** Product fields on the stored draft that the importer didn't write. */
export function fieldsAddedSince(existing: Record<string, unknown>, attempted: object) {
  return (PRODUCT_FIELDS as readonly string[]).filter((field) => field in existing && !(field in attempted));
}

function holds(stored: unknown, sent: unknown): boolean {
  if (Array.isArray(sent)) {
    return Array.isArray(stored) && stored.length === sent.length && sent.every((item, index) => holds(stored[index], item));
  }
  if (sent && typeof sent === "object") {
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return false;
    const record = stored as Record<string, unknown>;
    return Object.entries(sent).every(([key, value]) => holds(record[key], value));
  }
  return stored === sent;
}
