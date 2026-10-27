import { describe, expect, it } from "vitest";
import { product as productSchema } from "@/sanity/schemaTypes/product";
import { productVariant as variantSchema } from "@/sanity/schemaTypes/productVariant";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import {
  buildDraftDocument,
  DocumentBuildError,
  draftIdFor,
  fieldsAddedSince,
  isImageAssetId,
  matchesAttempt,
  PLACEHOLDER_ASSET_ID,
  PRODUCT_FIELDS,
  VARIANT_FIELDS,
} from "@/sanity/tools/bulk-import/documents";
import { buildImageLibrary, type LocalImage } from "@/sanity/tools/bulk-import/images";
import { buildImportPlan } from "@/sanity/tools/bulk-import/mapping";
import { matchImages } from "@/sanity/tools/bulk-import/matching";
import { imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

type RowInput = Partial<Record<ColumnName, string>>;

const sheet = (...rows: RowInput[]) => [
  [...COLUMN_NAMES],
  ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? "")),
];

async function prepare(rows: RowInput[], files: File[] = []) {
  const plan = buildImportPlan(sheet(...rows));
  expect(plan.summary.errors).toBe(0);
  const match = matchImages(plan, await buildImageLibrary(files));
  return { product: plan.products[0], match: match.products[0] };
}

const asset = (image: LocalImage) => `image-${image.key.replace(/\W/g, "")}-64x64-jpg`;
const resolution = (documentId: string, extra = {}) => ({ documentId, collections: [], supplier: null, ...extra });

const shoeRows: RowInput[] = [
  {
    handle: "shoe",
    title: "Canvas Shoe",
    price: "20000",
    option1_name: "Size",
    option1_value: "40",
    sku: "S40",
    variant_image: "s40.jpg",
    images: "shoe.jpg",
    image_alt: "A canvas shoe",
  },
  { handle: "shoe", title: "Canvas Shoe", price: "21000", option1_name: "Size", option1_value: "41", sku: "S41", variant_available: "no" },
];

describe("schema", () => {
  it("lists exactly the product and variant schema's fields", () => {
    expect([...PRODUCT_FIELDS].sort()).toEqual(productSchema.fields.map((field) => field.name).sort());
    expect([...VARIANT_FIELDS].sort()).toEqual(variantSchema.fields.map((field) => field.name).sort());
  });
});

describe("buildDraftDocument", () => {
  it("builds a draft, never a published document, keeping every planned value", async () => {
    const { product, match } = await prepare(
      [{ handle: "bag", title: "Leather Bag", price: "30000", sku: "B1", tags: "gift, leather", images: "front.jpg, side.jpg", image_alt: "Brown bag" }],
      [imageFile("front.jpg"), imageFile("side.jpg", 1)]
    );
    const document = buildDraftDocument(
      product,
      resolution("product-bag", {
        supplier: { name: "Lagos Leather", id: "supplier-1" },
        collections: [{ slug: "bags", id: "collection-bags", title: "Bags" }],
      }),
      match,
      asset
    );

    expect(document._id).toBe("drafts.product-bag");
    expect(document._type).toBe("product");
    for (const [field, value] of Object.entries(product.fields)) {
      expect(document[field], field).toEqual(JSON.parse(JSON.stringify(value)));
    }
    expect(document.supplier).toEqual({ _type: "reference", _ref: "supplier-1" });
    expect(document.collections).toEqual([{ _type: "reference", _ref: "collection-bags", _key: "collection-0" }]);
    expect(document.images).toEqual([
      { _type: "image", _key: "image-0", asset: { _type: "reference", _ref: "image-frontjpg-64x64-jpg" }, alt: "Brown bag" },
      { _type: "image", _key: "image-1", asset: { _type: "reference", _ref: "image-sidejpg-64x64-jpg" }, alt: "Brown bag" },
    ]);
  });

  it("keeps variant keys and combination keys, adding only variant images", async () => {
    const { product, match } = await prepare(shoeRows, [imageFile("shoe.jpg"), imageFile("s40.jpg", 1)]);
    const document = buildDraftDocument(product, resolution("product-shoe"), match, asset);
    const variants = document.variants as Record<string, unknown>[];

    expect(variants.map((variant) => [variant._key, variant.combinationKey, variant.available])).toEqual(
      product.fields.variants!.map((variant) => [variant._key, variant.combinationKey, variant.available])
    );
    expect(variants[1].available).toBe(false);
    expect(variants[0].image).toEqual({ _type: "image", asset: { _type: "reference", _ref: "image-s40jpg-64x64-jpg" } });
    expect(variants[1]).not.toHaveProperty("image");
    const rest = { ...variants[0] };
    delete rest.image;
    expect(rest).toEqual(JSON.parse(JSON.stringify(product.fields.variants![0])));
    expect(document.attributes).toEqual(JSON.parse(JSON.stringify(product.fields.attributes)));
  });

  it("leaves images out when building only to check permissions and the schema", async () => {
    const { product, match } = await prepare(shoeRows, [imageFile("shoe.jpg"), imageFile("s40.jpg", 1)]);
    const document = buildDraftDocument(product, resolution("product-shoe"), match, null);

    expect(document).not.toHaveProperty("images");
    expect((document.variants as Record<string, unknown>[]).some((variant) => "image" in variant)).toBe(false);
  });

  it("builds a product without images, with no images field", async () => {
    const { product, match } = await prepare([{ handle: "bag", title: "Bag", price: "100" }]);
    expect(buildDraftDocument(product, resolution("product-bag"), match, asset)).not.toHaveProperty("images");
  });

  it("refuses to build a product whose image wasn't uploaded", async () => {
    const { product, match } = await prepare([{ handle: "bag", title: "Bag", price: "100", images: "front.jpg" }], [
      imageFile("front.jpg"),
    ]);
    expect(() => buildDraftDocument(product, resolution("product-bag"), match, () => undefined)).toThrow(
      new DocumentBuildError("front.jpg hasn't been uploaded, so bag can't be created.")
    );
  });

  it("refuses a check that belongs to another product", async () => {
    const { product, match } = await prepare([{ handle: "bag", title: "Bag", price: "100" }]);
    expect(() => buildDraftDocument(product, resolution("product-belt"), match, asset)).toThrow(DocumentBuildError);
  });

  it("refuses an ID that isn't a plain published ID", () => {
    expect(draftIdFor("product-bag")).toBe("drafts.product-bag");
    expect(() => draftIdFor("drafts.product-bag")).toThrow(DocumentBuildError);
    expect(() => draftIdFor("")).toThrow(DocumentBuildError);
  });
});

describe("image asset IDs", () => {
  it("accepts only IDs shaped like an uploaded image's", () => {
    expect(isImageAssetId("image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg")).toBe(true);
    expect(isImageAssetId(PLACEHOLDER_ASSET_ID)).toBe(true);
    for (const id of ["", "image-frontjpg", "file-abc-pdf", "drafts.image-abc-1x1-png", "image-abc-1x1-PNG", null]) {
      expect(isImageAssetId(id), String(id)).toBe(false);
    }
  });

  it("refuses to build a product with an invalid image reference", async () => {
    const { product, match } = await prepare([{ handle: "bag", title: "Bag", price: "100", images: "front.jpg" }], [
      imageFile("front.jpg"),
    ]);
    expect(() => buildDraftDocument(product, resolution("product-bag"), match, () => "file-abc-pdf")).toThrow(
      new DocumentBuildError("front.jpg has an asset ID that isn't an image's (file-abc-pdf), so bag can't be created.")
    );
  });
});

describe("matchesAttempt", () => {
  async function sent() {
    const { product, match } = await prepare(shoeRows, [imageFile("shoe.jpg"), imageFile("s40.jpg", 1)]);
    return buildDraftDocument(product, resolution("product-shoe", { supplier: { name: "S", id: "supplier-1" } }), match, asset);
  }
  /** The draft as Sanity hands it back: system fields added, keys in another order. */
  const stored = (document: Record<string, unknown>, changes: Record<string, unknown> = {}): Record<string, unknown> => ({
    _rev: "rev-1",
    _createdAt: "2026-10-27T10:00:00Z",
    _updatedAt: "2026-10-27T10:00:00Z",
    ...Object.fromEntries(Object.entries(structuredClone(document)).reverse()),
    ...changes,
  });

  it("confirms the draft that was sent, whatever Sanity added", async () => {
    const document = await sent();
    const readBack = stored(document);
    (readBack.supplier as Record<string, unknown>)._weak = false;

    expect(matchesAttempt(readBack, document)).toBe(true);
    expect(fieldsAddedSince(readBack, document)).toEqual([]);
  });

  it("still confirms it after an editor added fields, and says which", async () => {
    const document = await sent();
    expect(document).not.toHaveProperty("category");
    expect(document).not.toHaveProperty("supplierProductId");
    const readBack = stored(document, { category: "Shoes", supplierProductId: "SP-1" });

    expect(matchesAttempt(readBack, document)).toBe(true);
    expect(fieldsAddedSince(readBack, document)).toEqual(["category", "supplierProductId"]);
  });

  it("rejects a draft whose authored values differ", async () => {
    const document = await sent();
    const variants = document.variants as Record<string, unknown>[];
    const images = document.images as Record<string, unknown>[];
    const changed = [
      { title: "Someone else's shoe" },
      { _type: "collection" },
      { slug: { _type: "slug", current: "other" } },
      { status: "active" },
      { variants: [{ ...variants[0], sku: "OTHER" }, variants[1]] },
      { variants: [{ ...variants[0], combinationKey: "size:42" }, variants[1]] },
      { variants: [variants[0], { ...variants[1], available: true }] },
      { variants: [variants[0]] },
      { variants: [variants[1], variants[0]] },
      { images: [{ ...images[0], asset: { _type: "reference", _ref: "image-other-1x1-png" } }] },
      { images: [] },
      { supplier: { _type: "reference", _ref: "supplier-2" } },
      { hasVariants: false },
      { featured: true },
    ];
    for (const change of changed) expect(matchesAttempt(stored(document, change), document), JSON.stringify(change)).toBe(false);

    const missingTitle = stored(document);
    delete missingTitle.title;
    expect(matchesAttempt(missingTitle, document)).toBe(false);
    expect(matchesAttempt(undefined, document)).toBe(false);
  });
});
