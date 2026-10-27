import type { SanityClient } from "sanity";
import { describe, expect, it, vi } from "vitest";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import { buildImageLibrary, emptyImageLibrary } from "@/sanity/tools/bulk-import/images";
import { buildImportPlan } from "@/sanity/tools/bulk-import/mapping";
import { matchImages } from "@/sanity/tools/bulk-import/matching";
import {
  fetchSanityIndex,
  LookupError,
  resolveImport,
  type ResolutionResult,
  type SanityIndex,
} from "@/sanity/tools/bulk-import/resolve";
import { imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

// The query string comes from next-sanity's defineQuery; the module is only read for it.
vi.mock("@/lib/sanity/queries", () => ({ BULK_IMPORT_INDEX_QUERY: "BULK_IMPORT_INDEX_QUERY" }));

type RowInput = Partial<Record<ColumnName, string>>;
type IndexInput = Partial<SanityIndex>;

function sheet(...rows: RowInput[]) {
  return [[...COLUMN_NAMES], ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? ""))];
}

const bag = (overrides: RowInput = {}): RowInput => ({ handle: "bag", title: "Leather Bag", price: "30000", ...overrides });

const shoe = (size: string, sku: string, overrides: RowInput = {}): RowInput => ({
  handle: "shoe",
  title: "Canvas Shoe",
  price: "20000",
  option1_name: "Size",
  option1_value: size,
  sku,
  ...overrides,
});

const product = (_id: string, fields: Partial<SanityIndex["products"][number]> = {}) => ({
  _id,
  title: "Existing",
  slug: null,
  baseSku: null,
  variantSkus: null,
  ...fields,
});

const collection = (_id: string, slug: string, fields: Partial<SanityIndex["collections"][number]> = {}) => ({
  _id,
  title: slug,
  slug,
  status: "active",
  ...fields,
});

const supplier = (_id: string, name: string) => ({ _id, name });

const index = (input: IndexInput = {}): SanityIndex => ({ products: [], collections: [], suppliers: [], ...input });

/** Resolves rows against the index; with no files, images are matched against an empty library. */
async function resolve(rows: RowInput[], input: IndexInput = {}, files?: File[]) {
  const plan = buildImportPlan(sheet(...rows));
  const library = files ? await buildImageLibrary(files) : emptyImageLibrary();
  return resolveImport(plan, matchImages(plan, library), index(input));
}

const outcomes = (result: ResolutionResult) =>
  Object.fromEntries(result.products.map((entry) => [entry.handle, entry.outcome]));
const reasons = (result: ResolutionResult, handle: string) =>
  result.products.find((entry) => entry.handle === handle)!.skipReasons;
const messages = (result: ResolutionResult, handle: string) => reasons(result, handle).map((entry) => entry.message);
const errors = (result: ResolutionResult) => result.issues.filter((issue) => issue.severity === "error");

describe("new products", () => {
  it("marks a product with no conflicts ready, with its references and images resolved", async () => {
    const result = await resolve(
      [bag({ images: "front.jpg", collections: "Bags", supplier: "  Lagos   Leather " })],
      {
        products: [product("product-wallet", { slug: "wallet", baseSku: "W1" })],
        collections: [collection("collection-bags", "bags", { title: "Bags" })],
        suppliers: [supplier("supplier-1", "Lagos Leather")],
      },
      [imageFile("front.jpg")]
    );

    expect(result.issues).toEqual([]);
    expect(result.products).toEqual([
      {
        handle: "bag",
        documentId: "product-bag",
        title: "Leather Bag",
        rows: [2],
        status: "draft",
        outcome: "ready",
        skipReasons: [],
        warnings: [],
        collections: [{ slug: "bags", id: "collection-bags", title: "Bags" }],
        supplier: { name: "Lagos Leather", id: "supplier-1" },
        images: ["front.jpg"],
        variantImages: [],
      },
    ]);
    expect(result.summary).toMatchObject({ checked: 1, ready: 1, warning: 0, blocked: 0, uploadImages: 1 });
  });
});

describe("existing products", () => {
  it("blocks a product whose document ID is already published", async () => {
    const result = await resolve([bag()], { products: [product("product-bag", { title: "Old Bag" })] });

    expect(outcomes(result)).toEqual({ bag: "blocked" });
    expect(reasons(result, "bag")).toEqual([
      {
        reason: "already-imported",
        message:
          'Already in the Studio as "Old Bag" (product-bag, published), probably from an earlier import. Skipped; it won\'t be changed.',
      },
    ]);
    expect(errors(result)).toEqual([
      expect.objectContaining({ severity: "error", row: 2, column: "handle", handle: "bag" }),
    ]);
    expect(result.summary).toMatchObject({ blocked: 1, alreadyImported: 1 });
  });

  it("counts drafts and release versions of the same product as existing, preferring the published title", async () => {
    const draftOnly = await resolve([bag()], { products: [product("drafts.product-bag", { title: "Draft Bag" })] });
    expect(messages(draftOnly, "bag")[0]).toContain('"Draft Bag" (product-bag, draft)');

    const versionOnly = await resolve([bag()], { products: [product("versions.r1.product-bag", { title: "Next Bag" })] });
    expect(messages(versionOnly, "bag")[0]).toContain('"Next Bag" (product-bag, in a release)');

    const both = await resolve([bag()], {
      products: [product("drafts.product-bag", { title: "Draft Bag" }), product("product-bag", { title: "Live Bag" })],
    });
    expect(messages(both, "bag")).toEqual([expect.stringContaining('"Live Bag" (product-bag, draft and published)')]);
  });

  it("blocks a slug used by another product, including one that's only a draft", async () => {
    const result = await resolve([bag({ slug: "leather-bag" })], {
      products: [product("drafts.product-satchel", { title: "Satchel", slug: "Leather-Bag" })],
    });

    expect(outcomes(result)).toEqual({ bag: "blocked" });
    expect(messages(result, "bag")).toEqual([
      'The slug "leather-bag" is already used by "Satchel" (product-satchel, draft).',
    ]);
    expect(result.summary.duplicates).toBe(1);
  });

  it("doesn't count a product's own slug and SKU as a clash with itself", async () => {
    const result = await resolve([bag({ slug: "bag", sku: "B1" })], {
      products: [product("product-bag", { slug: "bag", baseSku: "B1" })],
    });

    expect(reasons(result, "bag").map((entry) => entry.reason)).toEqual(["already-imported"]);
  });

  it("blocks a simple product's SKU used by another product, ignoring case", async () => {
    const result = await resolve([bag({ sku: "nk001" })], {
      products: [product("product-wallet", { title: "Wallet", baseSku: "NK001" })],
    });

    expect(messages(result, "bag")).toEqual(['The SKU "nk001" is already used by "Wallet" (product-wallet, published).']);
  });

  it("blocks a variant SKU used by another product's variant, on that variant's row", async () => {
    const result = await resolve([shoe("40", "SH-40"), shoe("41", "SH-41")], {
      products: [product("product-sneaker", { title: "Sneaker", variantSkus: ["sh-41", null] })],
    });

    expect(outcomes(result)).toEqual({ shoe: "blocked" });
    expect(errors(result)).toEqual([
      expect.objectContaining({
        row: 3,
        column: "sku",
        message: 'The SKU "SH-41" is already used by "Sneaker" (product-sneaker, published).',
      }),
    ]);
  });

  it("checks SKUs across simple and variant products in both directions", async () => {
    const simpleAgainstVariant = await resolve([bag({ sku: "X1" })], {
      products: [product("product-shoe", { variantSkus: ["x1"] })],
    });
    expect(outcomes(simpleAgainstVariant)).toEqual({ bag: "blocked" });

    const variantAgainstSimple = await resolve([shoe("40", "X2")], {
      products: [product("product-bag", { baseSku: "x2" })],
    });
    expect(outcomes(variantAgainstSimple)).toEqual({ shoe: "blocked" });
  });

  it("names clashing products by ID, whatever order Sanity returns them in", async () => {
    const products = [
      product("product-zeta", { title: "Zeta", slug: "leather-bag" }),
      product("product-alpha", { title: "Alpha", slug: "leather-bag" }),
    ];
    const forwards = await resolve([bag()], { products });
    const backwards = await resolve([bag()], { products: [...products].reverse() });

    expect(messages(forwards, "bag")).toEqual([
      'The slug "leather-bag" is already used by "Alpha" (product-alpha, published).',
    ]);
    expect(messages(backwards, "bag")).toEqual(messages(forwards, "bag"));
  });
});

describe("references", () => {
  it("blocks a missing collection or supplier, and never invents one", async () => {
    const result = await resolve([bag({ collections: "gifts", supplier: "Nobody" })], {
      collections: [collection("collection-bags", "bags")],
      suppliers: [supplier("supplier-1", "Lagos Leather")],
    });

    expect(outcomes(result)).toEqual({ bag: "blocked" });
    expect(messages(result, "bag")).toEqual([
      'No collection has the slug "gifts". Use the slug of an existing collection.',
      'No supplier is named "Nobody". Add it in the Studio first, or leave supplier blank.',
    ]);
    expect(result.products[0]).toMatchObject({ collections: [], supplier: null });
    expect(result.summary.missingReferences).toBe(1);
  });

  it("blocks ambiguous collections and suppliers, listing the documents by ID", async () => {
    const result = await resolve([bag({ collections: "bags", supplier: "Lagos Leather" })], {
      collections: [collection("collection-b", "bags"), collection("collection-a", "BAGS")],
      suppliers: [supplier("supplier-2", "lagos  leather"), supplier("supplier-1", "Lagos Leather")],
    });

    expect(messages(result, "bag")).toEqual([
      '2 collections have the slug "bags" (collection-a, collection-b). Make the slugs unique first.',
      '2 suppliers are named "Lagos Leather" (supplier-1, supplier-2). Rename one first.',
    ]);
  });

  it("treats a document and its draft as one, not as ambiguous", async () => {
    const result = await resolve([bag({ collections: "bags", supplier: "Lagos Leather" })], {
      collections: [collection("collection-bags", "bags"), collection("drafts.collection-bags", "bags")],
      suppliers: [supplier("supplier-1", "Lagos Leather"), supplier("drafts.supplier-1", "Lagos Leather")],
    });

    expect(outcomes(result)).toEqual({ bag: "warning" });
    expect(result.products[0].warnings).toEqual(["It has no gallery images, so it will show without a photo."]);
  });

  it("blocks references to collections and suppliers that are only drafts", async () => {
    const result = await resolve([bag({ collections: "bags", supplier: "Lagos Leather" })], {
      collections: [collection("drafts.collection-bags", "bags", { title: "Bags" })],
      suppliers: [supplier("drafts.supplier-1", "Lagos Leather")],
    });

    expect(messages(result, "bag")).toEqual([
      'The collection "Bags" (bags) is only a draft. Publish it before importing products into it.',
      'The supplier "Lagos Leather" is only a draft. Publish it first.',
    ]);
  });

  it("finds a published collection by its live slug, not a draft's pending one", async () => {
    const result = await resolve([bag({ collections: "bags" })], {
      collections: [collection("drafts.collection-bags", "handbags"), collection("collection-bags", "bags")],
    });

    expect(result.products[0].collections).toEqual([{ slug: "bags", id: "collection-bags", title: "bags" }]);
  });

  it("warns, without blocking, about collections that aren't active", async () => {
    const result = await resolve([bag({ collections: "old, soon", images: "front.jpg" })], {
      collections: [
        collection("collection-old", "old", { title: "Old", status: "archived" }),
        collection("collection-soon", "soon", { title: "Soon", status: "draft" }),
      ],
    }, [imageFile("front.jpg")]);

    expect(outcomes(result)).toEqual({ bag: "warning" });
    expect(result.products[0].warnings).toEqual([
      'The collection "Old" is archived, so it isn\'t shown on the storefront yet.',
      'The collection "Soon" is draft, so it isn\'t shown on the storefront yet.',
    ]);
    expect(result.products[0].collections.map((entry) => entry.id)).toEqual(["collection-old", "collection-soon"]);
  });
});

describe("images", () => {
  it("blocks only the products whose listed images are missing", async () => {
    const result = await resolve(
      [bag({ images: "front.jpg" }), bag({ handle: "belt", title: "Belt", images: "belt.jpg" })],
      {},
      [imageFile("belt.jpg")]
    );

    expect(outcomes(result)).toEqual({ bag: "blocked", belt: "ready" });
    expect(reasons(result, "bag")).toEqual([
      { reason: "images", message: "Some of its images are missing or ambiguous; see Choose images." },
    ]);
    expect(result.summary).toMatchObject({ missingImages: 1, uploadImages: 1 });
  });

  it("with no images chosen, blocks products that list images and only warns about those that don't", async () => {
    const result = await resolve([bag({ images: "front.jpg" }), bag({ handle: "belt", title: "Belt" })]);

    expect(outcomes(result)).toEqual({ bag: "blocked", belt: "warning" });
    expect(result.summary).toMatchObject({ ready: 0, warning: 1, blocked: 1, uploadImages: 0 });
  });

  it("blocks a variant product whose listed variant image is missing", async () => {
    const result = await resolve([shoe("40", "S40", { variant_image: "s40.jpg" }), shoe("41", "S41")], {}, [
      imageFile("S41.jpg"),
    ]);

    expect(outcomes(result)).toEqual({ shoe: "blocked" });
  });

  it("lists planned gallery and variant images for importable products", async () => {
    const result = await resolve([shoe("40", "S40", { images: "shoe.jpg" }), shoe("41", "S41")], {}, [
      imageFile("shoe.jpg"),
      imageFile("S41.jpg", 1),
    ]);

    expect(outcomes(result)).toEqual({ shoe: "ready" });
    expect(result.products[0].images).toEqual(["shoe.jpg"]);
    expect(result.products[0].variantImages).toEqual([{ combinationKey: expect.any(String), filename: "S41.jpg" }]);
    expect(result.summary.uploadImages).toBe(2);
  });

  it("counts an image shared by importable products once, and ignores blocked products' images", async () => {
    const result = await resolve(
      [
        bag({ images: "shared.jpg, bag.jpg" }),
        bag({ handle: "belt", title: "Belt", images: "shared.jpg" }),
        bag({ handle: "hat", title: "Hat", images: "hat.jpg" }),
      ],
      { products: [product("product-hat")] },
      [imageFile("shared.jpg", 1, 100), imageFile("bag.jpg", 2, 200), imageFile("hat.jpg", 3, 400)]
    );

    expect(outcomes(result)).toEqual({ bag: "ready", belt: "ready", hat: "blocked" });
    expect(result.summary).toMatchObject({ uploadImages: 2, uploadBytes: 300, sharedImages: 1 });
  });
});

describe("mixed outcomes", () => {
  it("previews valid products alongside blocked ones, leaving out spreadsheet rejects", async () => {
    const result = await resolve(
      [
        bag({ images: "bag.jpg", status: "active" }),
        bag({ handle: "belt", title: "Belt", collections: "gone" }),
        bag({ handle: "hat", title: "Hat" }),
        bag({ handle: "scarf", title: "Scarf", price: "" }),
        bag({ handle: "wallet", title: "Wallet" }),
      ],
      { products: [product("product-wallet")] },
      [imageFile("bag.jpg")]
    );

    expect(outcomes(result)).toEqual({ bag: "ready", belt: "blocked", hat: "warning", wallet: "blocked" });
    expect(result.summary).toEqual({
      checked: 4,
      ready: 1,
      warning: 1,
      blocked: 2,
      alreadyImported: 1,
      duplicates: 0,
      missingImages: 0,
      missingReferences: 1,
      rejectedInSpreadsheet: 1,
      activeIfPublished: 1,
      uploadImages: 1,
      uploadBytes: 64,
      sharedImages: 0,
    });
    // Issues are in spreadsheet order.
    expect(result.issues.map((issue) => issue.row)).toEqual([...result.issues.map((issue) => issue.row)].sort());
  });

  it("counts a product blocked for several reasons once, under the first", async () => {
    const result = await resolve([bag({ images: "front.jpg", supplier: "Nobody" })], {
      products: [product("product-bag")],
    });

    expect(reasons(result, "bag").map((entry) => entry.reason)).toEqual(["already-imported", "references", "images"]);
    expect(result.summary).toMatchObject({ blocked: 1, alreadyImported: 1, missingImages: 0, missingReferences: 0 });
  });
});

describe("fetchSanityIndex", () => {
  function client(fetch: () => Promise<unknown>) {
    const withConfig = vi.fn(() => ({ fetch: vi.fn(fetch) }));
    return { client: { withConfig } as unknown as SanityClient, withConfig };
  }

  it("reads drafts and versions too, bypassing the CDN", async () => {
    const { client: mock, withConfig } = client(async () => ({ products: [product("drafts.p")] }));

    await expect(fetchSanityIndex(mock)).resolves.toEqual({
      products: [product("drafts.p")],
      collections: [],
      suppliers: [],
    });
    expect(withConfig).toHaveBeenCalledWith({ perspective: "raw", useCdn: false });
    const reader = withConfig.mock.results[0].value as { fetch: ReturnType<typeof vi.fn> };
    expect(reader.fetch).toHaveBeenCalledWith("BULK_IMPORT_INDEX_QUERY");
  });

  it("treats an empty response as an empty dataset", async () => {
    await expect(fetchSanityIndex(client(async () => null).client)).resolves.toEqual(index());
  });

  it("explains a session that can't read the dataset", async () => {
    const failing = client(async () => Promise.reject(Object.assign(new Error("Unauthorized"), { statusCode: 401 })));
    const error = await fetchSanityIndex(failing.client).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LookupError);
    expect((error as Error).message).toBe(
      "Your Sanity session can't read this dataset. Log in again, or ask a project administrator for access."
    );
  });

  it("explains a request that didn't reach Sanity, without passing on the raw error", async () => {
    const failing = client(async () => Promise.reject(new Error("fetch failed: token=secret")));
    const error = await fetchSanityIndex(failing.client).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LookupError);
    expect((error as Error).message).toBe(
      "Couldn't reach Sanity to check existing products. Check your connection and try again."
    );
  });
});
