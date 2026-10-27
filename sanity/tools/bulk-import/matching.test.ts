import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import { buildImageLibrary } from "@/sanity/tools/bulk-import/images";
import { buildImportPlan } from "@/sanity/tools/bulk-import/mapping";
import { matchImages, type ImageMatchResult } from "@/sanity/tools/bulk-import/matching";
import { imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

type RowInput = Partial<Record<ColumnName, string>>;

function sheet(...rows: RowInput[]) {
  return [[...COLUMN_NAMES], ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? ""))];
}

async function match(rows: RowInput[], files: File[]) {
  const plan = buildImportPlan(sheet(...rows));
  expect(plan.summary.errors).toBe(0);
  return matchImages(plan, await buildImageLibrary(files));
}

const errors = (result: ImageMatchResult) =>
  result.issues.filter((issue) => issue.severity === "error").map(({ row, column, message }) => ({ row, column, message }));
const warnings = (result: ImageMatchResult) =>
  result.issues.filter((issue) => issue.severity === "warning").map(({ row, column, message }) => ({ row, column, message }));
const gallery = (result: ImageMatchResult, index = 0) =>
  result.products[index].gallery.map(({ filename, status, via }) => ({ filename, status, via }));

const bag = (overrides: RowInput = {}): RowInput => ({ handle: "bag", title: "Leather Bag", price: "30000", ...overrides });

describe("spreadsheet filenames", () => {
  it("matches listed images case-insensitively, keeping order, keys and alt text", async () => {
    const result = await match(
      [bag({ images: "Front.jpg, side.PNG", image_alt: "Brown bag" })],
      [imageFile("side.png", 2), imageFile("FRONT.JPG", 1)]
    );

    expect(result.issues).toEqual([]);
    const [product] = result.products;
    expect(product.ok).toBe(true);
    expect(product.fallbackId).toBeNull();
    expect(product.gallery.map(({ _key, filename, alt, status, image }) => ({ _key, filename, alt, status, file: image?.filename }))).toEqual([
      { _key: "image-0", filename: "Front.jpg", alt: "Brown bag", status: "matched", file: "FRONT.JPG" },
      { _key: "image-1", filename: "side.PNG", alt: "Brown bag", status: "matched", file: "side.png" },
    ]);
  });

  it("reports missing images, suggesting a file with the same name and another extension", async () => {
    const result = await match([bag({ images: "front.jpg, back.jpg" })], [imageFile("front.jpeg")]);

    expect(result.products[0].ok).toBe(false);
    expect(errors(result)).toEqual([
      { row: 2, column: "images", message: "front.jpg wasn't among the chosen images. Did you mean front.jpeg?" },
      { row: 2, column: "images", message: "back.jpg wasn't among the chosen images." },
    ]);
  });

  it("refuses ambiguous filenames rather than guessing", async () => {
    const result = await match([bag({ images: "front.jpg" })], [imageFile("front.jpg", 1), imageFile("FRONT.jpg", 2)]);
    expect(result.products[0].gallery[0].status).toBe("conflict");
    expect(errors(result)).toEqual([
      {
        row: 2,
        column: "images",
        message: "More than one different file is named front.jpg (front.jpg, FRONT.jpg). Rename one.",
      },
    ]);
  });

  it("explains why a chosen file can't be used", async () => {
    const result = await match([bag({ images: "front.jpg" })], [new File([strToU8("PDF")], "front.jpg")]);
    expect(result.products[0].gallery[0].status).toBe("rejected");
    expect(errors(result)).toEqual([
      {
        row: 2,
        column: "images",
        message: "front.jpg isn't a real JPG, PNG or WebP image. It may be another format renamed, or damaged.",
      },
    ]);
  });

  it("lets products share an image and lists chosen images nobody uses", async () => {
    const result = await match(
      [bag({ images: "shared.jpg" }), bag({ handle: "tote", title: "Tote", images: "shared.jpg" })],
      [imageFile("shared.jpg"), imageFile("typo.jpg")]
    );
    expect(result.summary).toMatchObject({ productsReady: 2, matched: 2, unused: 1 });
    expect(warnings(result)).toEqual([
      {
        row: null,
        column: "images",
        message: "1 chosen image isn't used by any product: typo.jpg. Check the filenames in the spreadsheet.",
      },
    ]);
  });
});

describe("SKU fallback", () => {
  it("uses files named after the SKU, in order, when no images are listed", async () => {
    const result = await match(
      [bag({ sku: "NK001", image_alt: "Sneaker" })],
      [imageFile("nk001_3.webp"), imageFile("NK001.jpg"), imageFile("nk001-02.png"), imageFile("nk0011.jpg")]
    );

    const [product] = result.products;
    expect(product.fallbackId).toBe("NK001");
    expect(product.ok).toBe(true);
    expect(gallery(result)).toEqual([
      { filename: "nk001.jpg", status: "matched", via: "sku" },
      { filename: "nk001-02.png", status: "matched", via: "sku" },
      { filename: "nk001_3.webp", status: "matched", via: "sku" },
    ]);
    expect(product.gallery.map((slot) => [slot._key, slot.alt])).toEqual([
      ["image-0", "Sneaker"],
      ["image-1", "Sneaker"],
      ["image-2", "Sneaker"],
    ]);
    expect(result.summary.matchedBySku).toBe(3);
  });

  it("falls back to the handle when the product has no SKU of its own", async () => {
    const simple = await match([bag()], [imageFile("bag.jpg"), imageFile("bag-2.jpg")]);
    expect(simple.products[0].fallbackId).toBe("bag");
    expect(gallery(simple).map((slot) => slot.filename)).toEqual(["bag.jpg", "bag-2.jpg"]);

    const variants = await match(
      [{ handle: "tee", title: "Tee", price: "5000", sku: "TEE-S", option1_name: "Size", option1_value: "S" }],
      [imageFile("tee.jpg")]
    );
    expect(variants.products[0].fallbackId).toBe("tee");
    expect(gallery(variants).map((slot) => slot.filename)).toEqual(["tee.jpg"]);
  });

  it("doesn't take a file that is named exactly after another SKU", async () => {
    const result = await match(
      [bag({ sku: "BAG" }), bag({ handle: "bag-two", title: "Bag Two", sku: "BAG-2" })],
      [imageFile("bag.jpg"), imageFile("bag-2.jpg"), imageFile("bag-3.jpg")]
    );
    // bag-2.jpg is named exactly after SKU BAG-2, so it isn't BAG's second image.
    expect(gallery(result, 0).map((slot) => slot.filename)).toEqual(["bag.jpg", "bag-3.jpg"]);
    expect(gallery(result, 1).map((slot) => slot.filename)).toEqual(["bag-2.jpg"]);
  });

  it("refuses two files competing for the same position", async () => {
    const result = await match([bag({ sku: "NK001" })], [imageFile("nk001.jpg"), imageFile("nk001.png", 1)]);
    expect(result.products[0].ok).toBe(false);
    expect(errors(result)).toEqual([
      {
        row: 2,
        column: "images",
        message: "nk001.jpg and nk001.png could both be image 1 for NK001. Keep one, or list the images in the spreadsheet.",
      },
    ]);
  });

  it("uses at most eight fallback images", async () => {
    const files = [imageFile("nk001.jpg"), ...Array.from({ length: 8 }, (_, index) => imageFile(`nk001-${index + 1}.jpg`, index))];
    const result = await match([bag({ sku: "NK001" })], files);
    expect(result.products[0].gallery).toHaveLength(8);
    expect(warnings(result)).toContainEqual({
      row: 2,
      column: "images",
      message: "More than 8 files are named after NK001; only the first 8 are used.",
    });
  });

  it("warns, without blocking, when nothing matches", async () => {
    const result = await match([bag({ sku: "NK001" })], [imageFile("other.jpg")]);
    expect(result.products[0].ok).toBe(true);
    expect(result.summary.productsWithoutImages).toBe(1);
    expect(warnings(result)).toContainEqual({
      row: 2,
      column: "images",
      message: "No images are listed, and none of the chosen files are named after NK001.",
    });
  });
});

describe("variant images", () => {
  const tee = (overrides: RowInput[] = []): RowInput[] => [
    { handle: "tee", title: "Tee", price: "5000", sku: "TEE-S", option1_name: "Size", option1_value: "S", images: "tee.jpg" },
    { handle: "tee", price: "5000", sku: "TEE-M", option1_value: "M" },
    ...overrides,
  ];

  it("matches variant_image by filename and falls back to a file named after the variant SKU", async () => {
    const rows = tee();
    rows[0].variant_image = "small.jpg";
    const result = await match(rows, [imageFile("tee.jpg"), imageFile("small.jpg", 1), imageFile("tee-m.png", 2)]);

    expect(result.issues).toEqual([]);
    expect(result.products[0].variantImages.map(({ combinationKey, filename, via, status }) => ({ combinationKey, filename, via, status }))).toEqual([
      { combinationKey: "size:s", filename: "small.jpg", via: "spreadsheet", status: "matched" },
      { combinationKey: "size:m", filename: "tee-m.png", via: "sku", status: "matched" },
    ]);
  });

  it("reports a missing variant image on the variant's own row", async () => {
    const rows = tee();
    rows[1].variant_image = "medium.jpg";
    const result = await match(rows, [imageFile("tee.jpg")]);
    expect(result.products[0].ok).toBe(false);
    expect(errors(result)).toEqual([{ row: 3, column: "variant_image", message: "medium.jpg wasn't among the chosen images." }]);
  });

  it("leaves variants without an image alone, and refuses ambiguous SKU files", async () => {
    const result = await match(tee(), [imageFile("tee.jpg"), imageFile("tee-m.jpg"), imageFile("tee-m.webp", 1)]);
    expect(result.products[0].variantImages.map((slot) => [slot.combinationKey, slot.status])).toEqual([["size:m", "conflict"]]);
    expect(errors(result)).toEqual([
      {
        row: 3,
        column: "variant_image",
        message: "Several files are named after SKU TEE-M (tee-m.jpg, tee-m.webp). Keep one, or name it in variant_image.",
      },
    ]);
  });
});

describe("summary", () => {
  it("counts ready and blocked products and matched images", async () => {
    const result = await match(
      [bag({ images: "a.jpg, missing.jpg" }), bag({ handle: "tote", title: "Tote", sku: "TOTE" })],
      [imageFile("a.jpg"), imageFile("tote.jpg", 1)]
    );
    expect(result.summary).toEqual({
      products: 2,
      productsReady: 1,
      productsBlocked: 1,
      productsWithoutImages: 0,
      matched: 2,
      matchedBySku: 1,
      unmatched: 1,
      unused: 0,
    });
  });
});
