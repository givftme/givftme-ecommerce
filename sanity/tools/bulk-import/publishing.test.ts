import { describe, expect, it } from "vitest";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import { buildImageLibrary, emptyImageLibrary } from "@/sanity/tools/bulk-import/images";
import { buildImportPlan } from "@/sanity/tools/bulk-import/mapping";
import { matchImages } from "@/sanity/tools/bulk-import/matching";
import { summarizePublish } from "@/sanity/tools/bulk-import/publishing";
import { resolveImport } from "@/sanity/tools/bulk-import/resolve";
import { imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

type RowInput = Partial<Record<ColumnName, string>>;

const sheet = (...rows: RowInput[]) => [
  [...COLUMN_NAMES],
  ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? "")),
];

async function summarize(rows: RowInput[], { files = [] as File[], existing = [] as string[] } = {}) {
  const plan = buildImportPlan(sheet(...rows));
  const images = matchImages(plan, files.length ? await buildImageLibrary(files) : emptyImageLibrary());
  const index = {
    products: existing.map((_id) => ({ _id, title: "Existing", slug: null, baseSku: null, variantSkus: null })),
    collections: [],
    suppliers: [],
  };
  return summarizePublish(plan, resolveImport(plan, images, index));
}

const product = (handle: string, overrides: RowInput = {}): RowInput => ({ handle, title: handle, price: "1000", ...overrides });
const variant = (handle: string, value: string, available: string, status = "active"): RowInput => ({
  handle,
  title: handle,
  price: "1000",
  status,
  option1_name: "Size",
  option1_value: value,
  variant_available: available,
});

describe("summarizePublish", () => {
  it("counts products that go live and products that stay hidden", async () => {
    const summary = await summarize(
      [
        product("mug", { status: "active", images: "mug.jpg" }),
        product("tote", { status: "draft", images: "tote.jpg" }),
        product("cap", { status: "archived", images: "cap.jpg" }),
      ],
      { files: [imageFile("mug.jpg"), imageFile("tote.jpg", 1), imageFile("cap.jpg", 2)] }
    );
    expect(summary).toEqual({ products: 3, live: 1, hidden: 2, warnings: [] });
  });

  it("warns about an active product with no images, but not a hidden one", async () => {
    const summary = await summarize([product("mug", { status: "active" }), product("tote", { status: "draft" })]);
    expect(summary.warnings).toEqual([
      { handle: "mug", title: "mug", message: "Active with no images: it will be live on the storefront without a photo." },
    ]);
  });

  it("warns when every variant is unavailable, saying whether it would be live", async () => {
    const summary = await summarize([
      variant("sock", "S", "no"),
      variant("sock", "M", "no"),
      variant("hat", "S", "no", "draft"),
      variant("glove", "S", "no"),
      variant("glove", "M", "yes"),
    ]);
    expect(summary.warnings.filter((warning) => warning.message.includes("variant"))).toEqual([
      { handle: "sock", title: "sock", message: "Every variant is unavailable: it will be live on the storefront but can't be bought." },
      { handle: "hat", title: "hat", message: "Every variant is unavailable, so it can't be bought once it's made active." },
    ]);
  });

  it("leaves out blocked products", async () => {
    const summary = await summarize([product("mug", { status: "active" }), product("tote")], { existing: ["product-mug"] });
    expect(summary).toEqual({ products: 1, live: 0, hidden: 1, warnings: [] });
  });
});
