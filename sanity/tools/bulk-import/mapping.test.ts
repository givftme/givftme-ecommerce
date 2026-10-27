import { describe, expect, it } from "vitest";
import { attributeOption } from "@/sanity/schemaTypes/attributeOption";
import { product as productSchema } from "@/sanity/schemaTypes/product";
import { productVariant } from "@/sanity/schemaTypes/productVariant";
import { variantAttribute } from "@/sanity/schemaTypes/variantAttribute";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import { buildImportPlan, MAX_PRODUCTS } from "@/sanity/tools/bulk-import/mapping";
import { parseCsv } from "@/sanity/tools/bulk-import/parse";
import { buildTemplateCsv } from "@/sanity/tools/bulk-import/template";
import type { ImportPlan } from "@/sanity/tools/bulk-import/types";

type RowInput = Partial<Record<ColumnName, string>>;

/** A table with every template column, so tests only spell out the cells they care about. */
function sheet(...rows: RowInput[]) {
  return [[...COLUMN_NAMES], ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? ""))];
}

const simple = (overrides: RowInput = {}): RowInput => ({
  handle: "leather-bag",
  title: "Leather Bag",
  price: "30000",
  images: "bag.jpg",
  ...overrides,
});

const errors = (plan: ImportPlan) =>
  plan.issues.filter((issue) => issue.severity === "error").map(({ row, column, message }) => ({ row, column, message }));
const warnings = (plan: ImportPlan) =>
  plan.issues.filter((issue) => issue.severity === "warning").map(({ row, column, message }) => ({ row, column, message }));

describe("simple products", () => {
  it("maps every column onto the product schema", () => {
    const plan = buildImportPlan(
      sheet({
        handle: "BG002",
        title: "Leather Weekend Bag",
        status: "Active",
        featured: "yes",
        short_description: "Full-grain leather.",
        description: "Hand-stitched.\nFits a laptop.",
        category: "Bags",
        tags: "leather, travel, leather",
        collections: "Travel-Gifts, birthday",
        supplier: "Lagos Leather Co",
        supplier_product_id: "LLC-77",
        estimated_delivery: "2-3 days",
        price: "₦30,000",
        compare_at_price: "35000",
        sale_price: "25000",
        sale_start: "2026-11-27 00:00",
        sale_end: "2026-11-30",
        sku: "BG002",
        images: "bag-front.jpg, photos/bag-side.PNG",
        image_alt: "Brown leather bag",
      })
    );

    expect(plan.issues).toEqual([]);
    expect(plan.products).toEqual([
      {
        handle: "BG002",
        documentId: "product-bg002",
        rows: [2],
        fields: {
          title: "Leather Weekend Bag",
          slug: { _type: "slug", current: "leather-weekend-bag" },
          status: "active",
          featured: true,
          shortDescription: "Full-grain leather.",
          description: [
            {
              _type: "block",
              _key: "block-0",
              style: "normal",
              markDefs: [],
              children: [{ _type: "span", _key: "span-0", text: "Hand-stitched.", marks: [] }],
            },
            {
              _type: "block",
              _key: "block-1",
              style: "normal",
              markDefs: [],
              children: [{ _type: "span", _key: "span-1", text: "Fits a laptop.", marks: [] }],
            },
          ],
          category: "Bags",
          tags: ["leather", "travel"],
          supplierProductId: "LLC-77",
          estimatedDeliveryDays: "2-3 days",
          hasVariants: false,
          basePrice: 30000,
          compareAtPrice: 35000,
          baseSku: "BG002",
          salePrice: 25000,
          saleStartTime: "2026-11-26T23:00:00.000Z",
          saleEndTime: "2026-11-30T22:59:59.000Z",
        },
        collectionSlugs: ["travel-gifts", "birthday"],
        supplierName: "Lagos Leather Co",
        images: [
          { _key: "image-0", filename: "bag-front.jpg", alt: "Brown leather bag" },
          { _key: "image-1", filename: "bag-side.PNG", alt: "Brown leather bag" },
        ],
        imageAlt: "Brown leather bag",
        variantImages: [],
      },
    ]);
  });

  it("applies the schema's initial values to blank cells", () => {
    const [product] = buildImportPlan(sheet(simple())).products;

    expect(product.fields).toEqual({
      title: "Leather Bag",
      slug: { _type: "slug", current: "leather-bag" },
      status: "draft",
      featured: false,
      estimatedDeliveryDays: "5-10 days",
      hasVariants: false,
      basePrice: 30000,
    });
    expect(product.images[0].alt).toBe("Leather Bag");
    expect(product.imageAlt).toBe("Leather Bag");
    expect(product.supplierName).toBeNull();
  });

  it("rejects missing titles and prices, and kobo, zero or text prices", () => {
    const plan = buildImportPlan(
      sheet(
        simple({ handle: "a", title: "" }),
        simple({ handle: "b", price: "" }),
        simple({ handle: "c", price: "1500.50" }),
        simple({ handle: "d", price: "0" }),
        simple({ handle: "e", price: "TBC" }),
        simple({ handle: "f", title: "Fine" })
      )
    );

    expect(errors(plan)).toEqual([
      { row: 2, column: "title", message: "A title is required." },
      { row: 3, column: "price", message: "A price is required." },
      { row: 4, column: "price", message: "Use a whole naira amount, without kobo." },
      { row: 5, column: "price", message: "The amount must be more than ₦0." },
      { row: 6, column: "price", message: '"TBC" isn\'t a number. Use whole naira, e.g. 45000.' },
    ]);
    expect(plan.products.map((product) => product.handle)).toEqual(["f"]);
    expect(plan.rejectedHandles).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("rejects unknown statuses and yes/no values", () => {
    const plan = buildImportPlan(
      sheet(simple({ handle: "a", status: "published" }), simple({ handle: "b", featured: "sometimes" }))
    );
    expect(errors(plan)).toEqual([
      { row: 2, column: "status", message: "Status must be draft, active or archived." },
      { row: 3, column: "featured", message: '"sometimes" isn\'t yes or no.' },
    ]);
  });

  it("rejects variant-only columns, pointing simple products at status for availability", () => {
    const plan = buildImportPlan(sheet(simple({ variant_available: "no", variant_image: "x.jpg" })));
    expect(errors(plan)).toEqual([
      {
        row: 2,
        column: "variant_available",
        message: "Only variants have availability. To hide a simple product, set its status to draft or archived.",
      },
      {
        row: 2,
        column: "variant_image",
        message: "This column only applies to variant rows, which have option values.",
      },
    ]);
  });

  it("warns about long card copy, missing images and compare-at prices with no discount", () => {
    const plan = buildImportPlan(
      sheet(simple({ short_description: "x".repeat(181), images: "", compare_at_price: "30000" }))
    );
    expect(plan.products).toHaveLength(1);
    expect(warnings(plan)).toEqual([
      { row: 2, column: "short_description", message: "This is 181 characters; keep card copy under 180." },
      {
        row: 2,
        column: "images",
        message: "No images are listed; files named after the SKU or handle will be used if found.",
      },
      {
        row: 2,
        column: "compare_at_price",
        message: "The compare-at price isn't higher than the price, so no discount will show.",
      },
    ]);
  });
});

describe("variant products", () => {
  const sneakers = sheet(
    {
      handle: "sneakers",
      title: "Classic Sneakers",
      price: "45000",
      sku: "NK-40-WHT",
      option1_name: "Shoe Size",
      option1_value: "40",
      option2_name: "Colour",
      option2_value: "Off White",
      variant_supplier_sku: "SUP-40",
      variant_supplier_product_id: "SP-1",
      variant_image: "white.jpg",
      images: "sneakers.jpg",
      sale_price: "40000",
      sale_start: "2026-11-27",
      sale_end: "2026-11-30",
    },
    {
      handle: "SNEAKERS",
      price: "47000",
      compare_at_price: "50000",
      sku: "NK-41-WHT",
      option1_value: "41",
      option2_name: "colour",
      option2_value: "Off White",
      variant_available: "sold out",
    },
    { handle: "sneakers", title: "Classic Sneakers", price: "45000", option1_value: "40", option2_value: "Black" }
  );

  it("builds attributes, variants and combination keys the storefront can match", () => {
    const plan = buildImportPlan(sneakers);
    expect(plan.issues).toEqual([]);

    const [product] = plan.products;
    expect(product.rows).toEqual([2, 3, 4]);
    expect(product.fields.hasVariants).toBe(true);
    expect(product.fields).not.toHaveProperty("basePrice");
    expect(product.fields).not.toHaveProperty("baseSku");
    expect(product.fields.attributes).toEqual([
      {
        _type: "variantAttribute",
        _key: "attr-shoe_size",
        name: "shoe_size",
        label: "Shoe Size",
        options: [
          { _type: "attributeOption", _key: "option-40", label: "40", value: "40" },
          { _type: "attributeOption", _key: "option-41", label: "41", value: "41" },
        ],
      },
      {
        _type: "variantAttribute",
        _key: "attr-colour",
        name: "colour",
        label: "Colour",
        options: [
          { _type: "attributeOption", _key: "option-off-white", label: "Off White", value: "off-white" },
          { _type: "attributeOption", _key: "option-black", label: "Black", value: "black" },
        ],
      },
    ]);
    expect(product.fields.variants).toEqual([
      {
        _type: "productVariant",
        _key: "variant-0",
        combinationKey: "shoe_size:40|colour:off-white",
        options: [
          { _key: "shoe_size", attribute: "shoe_size", value: "40" },
          { _key: "colour", attribute: "colour", value: "off-white" },
        ],
        price: 45000,
        sku: "NK-40-WHT",
        supplierSku: "SUP-40",
        supplierProductId: "SP-1",
        available: true,
      },
      {
        _type: "productVariant",
        _key: "variant-1",
        combinationKey: "shoe_size:41|colour:off-white",
        options: [
          { _key: "shoe_size", attribute: "shoe_size", value: "41" },
          { _key: "colour", attribute: "colour", value: "off-white" },
        ],
        price: 47000,
        compareAtPrice: 50000,
        sku: "NK-41-WHT",
        available: false,
      },
      {
        _type: "productVariant",
        _key: "variant-2",
        combinationKey: "shoe_size:40|colour:black",
        options: [
          { _key: "shoe_size", attribute: "shoe_size", value: "40" },
          { _key: "colour", attribute: "colour", value: "black" },
        ],
        price: 45000,
        available: true,
      },
    ]);
    expect(product.variantImages).toEqual([{ combinationKey: "shoe_size:40|colour:off-white", filename: "white.jpg" }]);
    expect(product.fields.salePrice).toBe(40000);
  });

  it("gives every variant option a matching attribute option, as the storefront requires", () => {
    const [product] = buildImportPlan(sneakers).products;
    for (const variant of product.fields.variants ?? []) {
      for (const option of variant.options) {
        const attribute = product.fields.attributes?.find((candidate) => candidate.name === option.attribute);
        expect(attribute?.options.map((entry) => entry.value)).toContain(option.value);
      }
    }
  });

  it("requires every variant to have a price and every option value", () => {
    const plan = buildImportPlan(
      sheet(
        { handle: "tee", title: "Tee", price: "5000", option1_name: "Size", option1_value: "M" },
        { handle: "tee", price: "", option1_value: "L" },
        { handle: "tee", price: "5000", option1_value: "" , sku: "TEE-X" }
      )
    );
    expect(errors(plan)).toEqual([
      { row: 3, column: "price", message: "A price is required." },
      { row: 4, column: "option1_value", message: "Every variant needs a Size value." },
    ]);
    expect(plan.products).toEqual([]);
    expect(plan.rejectedHandles).toEqual(["tee"]);
  });

  it("rejects duplicate combinations and conflicting option names", () => {
    const plan = buildImportPlan(
      sheet(
        { handle: "tee", title: "Tee", price: "5000", option1_name: "Size", option1_value: "M" },
        { handle: "tee", price: "5000", option1_value: "m" },
        { handle: "tee", price: "5000", option1_name: "Colour", option1_value: "L" },
        { handle: "tee", price: "5000", option1_value: "XL", option2_value: "Red" }
      )
    );
    expect(errors(plan)).toEqual([
      { row: 3, column: "option1_value", message: "Row 2 already has these options (size:m)." },
      { row: 4, column: "option1_name", message: 'Doesn\'t match "Size" on row 2.' },
      { row: 5, column: "option2_value", message: "option2_value needs option2_name on the product's first row." },
    ]);
  });

  it("needs option names on the first row", () => {
    const plan = buildImportPlan(
      sheet(
        { handle: "tee", title: "Tee", price: "5000" },
        { handle: "tee", price: "5000", option1_name: "Size", option1_value: "L" }
      )
    );
    expect(errors(plan)).toEqual([
      {
        row: 2,
        column: "option1_name",
        message:
          "Rows for this handle have option values, so the product's first row needs option names, e.g. option1_name = Size.",
      },
    ]);
  });

  it("rejects later rows that contradict product-level fields", () => {
    const plan = buildImportPlan(
      sheet(
        { handle: "tee", title: "Tee", price: "5000", option1_name: "Size", option1_value: "M", category: "Tops" },
        { handle: "tee", title: "Tee", price: "5000", option1_value: "L", category: "Shirts" }
      )
    );
    expect(errors(plan)).toEqual([
      {
        row: 3,
        column: "category",
        message: "Doesn't match the product's first row (row 2). Leave it blank on variant rows or repeat the same value.",
      },
    ]);
  });

  it("compares a variant product's sale price with its lowest variant price", () => {
    const plan = buildImportPlan(
      sheet(
        {
          handle: "tee",
          title: "Tee",
          price: "9000",
          option1_name: "Size",
          option1_value: "L",
          sale_price: "6000",
          sale_start: "2026-11-27",
          sale_end: "2026-11-30",
        },
        { handle: "tee", price: "5000", option1_value: "S" }
      )
    );
    expect(errors(plan)).toEqual([
      { row: 2, column: "sale_price", message: "The sale price must be less than the lowest variant price (₦5,000)." },
    ]);
  });
});

describe("handles, slugs and SKUs", () => {
  it("rejects blank and malformed handles", () => {
    const plan = buildImportPlan(sheet(simple({ handle: "" }), simple({ handle: "bag.v2" }), simple({ handle: "ok" })));
    expect(errors(plan)).toEqual([
      { row: 2, column: "handle", message: "Every row needs a handle." },
      {
        row: 3,
        column: "handle",
        message: "Handles use letters, numbers, hyphens or underscores, up to 80 characters.",
      },
    ]);
    expect(plan.products.map((product) => product.handle)).toEqual(["ok"]);
  });

  it("rejects simple products that share a handle, ignoring case", () => {
    const plan = buildImportPlan(sheet(simple({ handle: "Bag" }), simple({ handle: "bag", title: "Other bag" })));
    expect(errors(plan)).toEqual([
      { row: 3, column: "title", message: expect.stringContaining("Doesn't match the product's first row") },
      {
        row: 3,
        column: "handle",
        message:
          'The handle "Bag" is already used on row 2. Give each product its own handle; only variant rows (with option values) share one.',
      },
    ]);
    expect(plan.products).toEqual([]);
  });

  it("rejects duplicate slugs across products; the first keeps it", () => {
    const plan = buildImportPlan(
      sheet(simple({ handle: "a", title: "Gift Box" }), simple({ handle: "b", title: "Gift  box!" }))
    );
    expect(errors(plan)).toEqual([
      { row: 3, column: "slug", message: 'The slug "gift-box" is already used by a on row 2.' },
    ]);
    expect(plan.products.map((product) => product.handle)).toEqual(["a"]);
    expect(plan.rejectedHandles).toEqual(["b"]);
  });

  it("normalises a written slug and warns, and rejects slugs that can't be made", () => {
    const plan = buildImportPlan(
      sheet(simple({ handle: "a", slug: "My Bag" }), simple({ handle: "b", title: "🎁" }), simple({ handle: "c", slug: "!!!" }))
    );
    expect(plan.products[0].fields.slug.current).toBe("my-bag");
    expect(warnings(plan)).toContainEqual({ row: 2, column: "slug", message: 'The slug will be saved as "my-bag".' });
    expect(errors(plan)).toEqual([
      { row: 3, column: "slug", message: "Couldn't make a slug from the title. Add one in the slug column." },
      { row: 4, column: "slug", message: "The slug needs letters or numbers." },
    ]);
  });

  it("rejects duplicate SKUs across products and variants, ignoring case", () => {
    const plan = buildImportPlan(
      sheet(
        simple({ handle: "a", title: "Bag A", sku: "SKU-1" }),
        simple({ handle: "b", title: "Bag B", sku: "sku-1" }),
        { handle: "c", title: "Tee", price: "5000", sku: "TEE", option1_name: "Size", option1_value: "S" },
        { handle: "c", price: "5000", sku: "TEE", option1_value: "M" }
      )
    );
    expect(errors(plan)).toEqual([
      { row: 3, column: "sku", message: 'The SKU "sku-1" is already used by a on row 2.' },
      { row: 5, column: "sku", message: 'The SKU "TEE" is already used by row 4.' },
    ]);
    expect(plan.products.map((product) => product.handle)).toEqual(["a"]);
  });

  it("rejects SKUs with spaces", () => {
    const plan = buildImportPlan(sheet(simple({ sku: "BG 002" })));
    expect(errors(plan)).toEqual([{ row: 2, column: "sku", message: "SKUs can't contain spaces." }]);
  });

  it("derives document IDs that never contain dots", () => {
    const [product] = buildImportPlan(sheet(simple({ handle: "NK_001-a" }))).products;
    expect(product.documentId).toBe("product-nk_001-a");
  });
});

describe("images and collections", () => {
  it("rejects unsupported image types and more than eight images", () => {
    const nine = Array.from({ length: 9 }, (_, index) => `img-${index}.jpg`).join(",");
    const plan = buildImportPlan(sheet(simple({ handle: "a", images: "a.gif, b.jpg" }), simple({ handle: "b", images: nine })));
    expect(errors(plan)).toEqual([
      { row: 2, column: "images", message: '"a.gif" isn\'t a JPG, PNG or WebP file.' },
      { row: 3, column: "images", message: "9 images are listed; a product can have up to 8." },
    ]);
  });

  it("uses a filename listed twice only once", () => {
    const plan = buildImportPlan(sheet(simple({ images: "bag.jpg, BAG.jpg" })));
    expect(plan.products[0].images.map((image) => image.filename)).toEqual(["bag.jpg"]);
    expect(warnings(plan)).toEqual([
      { row: 2, column: "images", message: '"BAG.jpg" is listed twice; it will be used once.' },
    ]);
  });

  it("asks for collection slugs rather than titles", () => {
    const plan = buildImportPlan(sheet(simple({ collections: "Birthday Gifts" })));
    expect(errors(plan)).toEqual([
      {
        row: 2,
        column: "collections",
        message: '"Birthday Gifts" isn\'t a collection slug. Use the slug, e.g. birthday-gifts.',
      },
    ]);
  });
});

describe("flash sales", () => {
  it("needs all three sale columns", () => {
    const plan = buildImportPlan(sheet(simple({ sale_price: "20000" })));
    expect(errors(plan)).toEqual([
      { row: 2, column: "sale_start", message: "A flash sale needs sale_price, sale_start and sale_end." },
      { row: 2, column: "sale_end", message: "A flash sale needs sale_price, sale_start and sale_end." },
    ]);
  });

  it("rejects sales that end before they start or don't discount", () => {
    const plan = buildImportPlan(
      sheet(simple({ sale_price: "30000", sale_start: "2026-11-30 10:00", sale_end: "2026-11-30 09:00" }))
    );
    expect(errors(plan)).toEqual([
      { row: 2, column: "sale_end", message: "The sale must end after it starts." },
      { row: 2, column: "sale_price", message: "The sale price must be less than the price (₦30,000)." },
    ]);
  });

  it("rejects unreadable sale dates", () => {
    const plan = buildImportPlan(sheet(simple({ sale_price: "20000", sale_start: "27/11/2026", sale_end: "2026-11-30" })));
    expect(errors(plan)).toEqual([
      {
        row: 2,
        column: "sale_start",
        message: '"27/11/2026" isn\'t a date. Use YYYY-MM-DD HH:mm, e.g. 2026-11-01 09:00.',
      },
    ]);
  });
});

describe("file structure", () => {
  it("rejects files without headers, rows or required columns", () => {
    expect(errors(buildImportPlan([]))).toEqual([
      { row: null, column: null, message: "The first row must hold the column names. Start from the template." },
    ]);
    expect(errors(buildImportPlan(sheet()))).toEqual([
      { row: null, column: null, message: "The spreadsheet has no product rows." },
    ]);
    expect(errors(buildImportPlan([["handle", "Title"], ["bag", "Bag"]]))).toEqual([
      { row: null, column: null, message: "Missing required column: price." },
    ]);
  });

  it("accepts columns in any order and case, and warns about unknown ones", () => {
    const plan = buildImportPlan([
      ["Price", "Title", "Handle", "Stock"],
      ["5000", "Mug", "mug", "20"],
    ]);
    expect(plan.products).toHaveLength(1);
    expect(warnings(plan)).toContainEqual({
      row: null,
      column: "Stock",
      message: 'The "Stock" column isn\'t used by the importer and will be ignored.',
    });
  });

  it("rejects duplicate columns", () => {
    const plan = buildImportPlan([
      ["handle", "title", "price", "Price"],
      ["mug", "Mug", "5000", "6000"],
    ]);
    expect(errors(plan)).toEqual([{ row: null, column: null, message: 'The "price" column appears more than once.' }]);
    expect(plan.products).toEqual([]);
  });

  it("numbers rows as the spreadsheet does, counting blank rows", () => {
    const plan = buildImportPlan(parseCsv("handle,title,price\nmug,Mug,5000\n\n,,\ncup,Cup,abc\n"));
    expect(errors(plan)).toEqual([{ row: 5, column: "price", message: expect.stringContaining('"abc"') }]);
    expect(plan.summary.rows).toBe(2);
  });

  it(`caps an import at ${MAX_PRODUCTS} products`, () => {
    const rows = Array.from({ length: MAX_PRODUCTS + 1 }, (_, index) => simple({ handle: `p${index}`, title: `P ${index}` }));
    const plan = buildImportPlan(sheet(...rows));
    expect(errors(plan)).toEqual([
      {
        row: null,
        column: null,
        message: `The spreadsheet has ${MAX_PRODUCTS + 1} products; the limit is ${MAX_PRODUCTS}. Split it into smaller files.`,
      },
    ]);
    expect(plan.products).toEqual([]);
  });

  it("summarises valid and rejected products", () => {
    const plan = buildImportPlan(
      sheet(
        simple({ handle: "a", title: "A" }),
        simple({ handle: "b", title: "B", price: "" }),
        { handle: "c", title: "C", price: "5000", option1_name: "Size", option1_value: "S" },
        { handle: "c", price: "5000", option1_value: "M" }
      )
    );
    expect(plan.summary).toEqual({
      rows: 4,
      products: 2,
      simpleProducts: 1,
      variantProducts: 1,
      variants: 2,
      rejectedProducts: 1,
      errors: 1,
      warnings: 1,
    });
  });
});

describe("template", () => {
  it("imports cleanly", () => {
    const plan = buildImportPlan(parseCsv(buildTemplateCsv()));
    expect(plan.issues).toEqual([]);
    expect(plan.summary).toMatchObject({ products: 2, simpleProducts: 1, variantProducts: 1, variants: 2 });
  });

  it("has a column for every importer column, in order", () => {
    expect(parseCsv(buildTemplateCsv())[0]).toEqual([...COLUMN_NAMES]);
  });
});

describe("schema compatibility", () => {
  const fieldNames = (type: { fields: readonly { name: string }[] }) => type.fields.map((field) => field.name);
  const ownKeys = (value: object) => Object.keys(value).filter((key) => !key.startsWith("_"));

  it("only writes fields that exist on the Sanity schemas", () => {
    const plan = buildImportPlan(parseCsv(buildTemplateCsv()));
    const productFields = fieldNames(productSchema);

    for (const product of plan.products) {
      expect(productFields).toEqual(expect.arrayContaining(ownKeys(product.fields)));
      for (const attribute of product.fields.attributes ?? []) {
        expect(fieldNames(variantAttribute)).toEqual(expect.arrayContaining(ownKeys(attribute)));
        for (const option of attribute.options) {
          expect(fieldNames(attributeOption)).toEqual(expect.arrayContaining(ownKeys(option)));
        }
      }
      for (const variant of product.fields.variants ?? []) {
        expect(fieldNames(productVariant)).toEqual(expect.arrayContaining(ownKeys(variant)));
      }
    }
  });

  it("only fills the price fields the schema shows for each product kind", () => {
    const [simpleProduct, variantProduct] = buildImportPlan(parseCsv(buildTemplateCsv())).products;
    expect(simpleProduct.fields).not.toHaveProperty("attributes");
    expect(simpleProduct.fields).not.toHaveProperty("variants");
    expect(variantProduct.fields).not.toHaveProperty("basePrice");
    expect(variantProduct.fields).not.toHaveProperty("compareAtPrice");
    expect(variantProduct.fields).not.toHaveProperty("baseSku");
  });
});
