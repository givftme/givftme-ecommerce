import { evaluate, parse } from "groq-js";
import { createHash } from "node:crypto";
import type { SanityClient } from "sanity";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toCsv } from "@/lib/admin/csv";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import {
  createImportSession,
  runDraftImport,
  runDraftPreflight,
  unusedAssets,
  type DraftImportDeps,
  type ImportRun,
} from "@/sanity/tools/bulk-import/execute";
import { buildImageLibrary, emptyImageLibrary } from "@/sanity/tools/bulk-import/images";
import { buildImportPlan } from "@/sanity/tools/bulk-import/mapping";
import { matchImages } from "@/sanity/tools/bulk-import/matching";
import { readSpreadsheet } from "@/sanity/tools/bulk-import/parse";
import { fetchSanityIndex, resolveImport } from "@/sanity/tools/bulk-import/resolve";
import {
  FIRST_LIVE_TEST_IMAGES,
  FIRST_LIVE_TEST_ROWS,
  imageFile,
  solidPng,
} from "@/sanity/tools/bulk-import/test-fixtures";

// The client is fake, but its queries are the real GROQ, run by groq-js over
// an in-memory dataset. Nothing here talks to Sanity.

type RowInput = Partial<Record<ColumnName, string>>;
type Doc = { _id: string; _type: string; [field: string]: unknown };

const WRITE_METHODS = ["patch", "delete", "createOrReplace", "createIfNotExists", "mutate", "transaction", "publish", "unpublish", "discardDraft"];
const forbidden: string[] = [];
afterEach(() => {
  expect(forbidden, "client methods that must never be used").toEqual([]);
  forbidden.length = 0;
});

const sheet = (...rows: RowInput[]) => [
  [...COLUMN_NAMES],
  ...rows.map((row) => COLUMN_NAMES.map((column) => row[column] ?? "")),
];

const error = (statusCode: number | undefined, message: string) => Object.assign(new Error(message), { statusCode });

function fakeStudio(initial: Doc[]) {
  const docs = new Map(initial.map((doc) => [doc._id, doc]));
  const state = { projectId: "proj", dataset: "development" };
  const hooks: {
    fetch?: (params: Record<string, unknown>) => unknown;
    create?: (doc: Doc) => unknown;
    upload?: (filename: string) => unknown;
    assetId?: (filename: string) => string;
    getDocument?: (id: string) => unknown;
  } = {};
  const configs: unknown[] = [];

  const fetch = vi.fn(async (query: string, params: Record<string, unknown> = {}) => {
    const failure = hooks.fetch?.(params);
    if (failure) throw failure;
    const value = await evaluate(parse(query, { params }), { dataset: [...docs.values()], params });
    return value.get();
  });
  const create = vi.fn(async (doc: Doc) => {
    const failure = hooks.create?.(doc);
    if (failure) throw failure;
    if (docs.has(doc._id)) throw error(409, `Document by ID "${doc._id}" already exists`);
    docs.set(doc._id, structuredClone(doc));
    return doc;
  });
  const upload = vi.fn(async (_type: string, _blob: Blob, { filename }: { filename: string }) => {
    const failure = hooks.upload?.(filename);
    if (failure) throw failure;
    return { _id: hooks.assetId?.(filename) ?? `image-${filename.replace(/\W/g, "")}-1x1-png` };
  });
  const getDocument = vi.fn(async (id: string) => {
    const failure = hooks.getDocument?.(id);
    if (failure) throw failure;
    return docs.get(id);
  });

  const guard = <T extends object>(target: T, name: string) =>
    new Proxy(target, {
      get(object, property) {
        if (typeof property === "string" && WRITE_METHODS.includes(property)) forbidden.push(`${name}.${property}`);
        return Reflect.get(object, property);
      },
    });
  const client = guard(
    {
      config: () => ({ ...state }),
      withConfig: (config: unknown) => {
        configs.push(config);
        return { fetch };
      },
      getDocument,
      create,
      assets: guard({ upload }, "client.assets"),
    },
    "client"
  ) as unknown as SanityClient;

  return { client, docs, state, hooks, configs, fetch, create, upload, getDocument };
}

const collectionDoc = (slug: string, status = "active"): Doc => ({
  _id: `collection-${slug}`,
  _type: "collection",
  title: slug,
  slug: { current: slug },
  status,
});
const supplierDoc: Doc = { _id: "supplier-1", _type: "supplier", name: "Lagos Leather" };
const productDoc = (id: string, fields: Record<string, unknown> = {}): Doc => ({ _id: id, _type: "product", title: "Existing", ...fields });

const bag = (overrides: RowInput = {}): RowInput => ({ handle: "bag", title: "Leather Bag", price: "30000", ...overrides });
const belt = (overrides: RowInput = {}): RowInput => ({ handle: "belt", title: "Belt", price: "9000", ...overrides });
const shoe = (size: string, sku: string, overrides: RowInput = {}): RowInput => ({
  handle: "shoe",
  title: "Canvas Shoe",
  price: "20000",
  option1_name: "Size",
  option1_value: size,
  sku,
  ...overrides,
});

/** Builds the plan, images and Phase 4 preview exactly as the tool does, then a runner. */
async function setup(rows: RowInput[], { docs = [] as Doc[], files = [] as File[] } = {}) {
  const plan = buildImportPlan(sheet(...rows));
  const images = matchImages(plan, files.length ? await buildImageLibrary(files) : emptyImageLibrary());
  const studio = fakeStudio([collectionDoc("bags"), supplierDoc, ...docs]);
  const preview = resolveImport(plan, images, await fetchSanityIndex(studio.client));
  studio.fetch.mockClear();
  const session = createImportSession();
  const deps: DraftImportDeps = {
    client: studio.client,
    workspace: { projectId: "proj", dataset: "development" },
    checkPermission: vi.fn(async () => ({ granted: true, reason: "" })),
    validate: vi.fn(async () => []),
  };
  const run = (overrides: Partial<DraftImportDeps> = {}, only?: ReadonlySet<string>) =>
    runDraftImport({ plan, images, preview, session, only }, { ...deps, ...overrides });
  return { plan, images, preview, studio, session, deps, run };
}

const statuses = (run: ImportRun) => Object.fromEntries(run.results.map((result) => [result.handle, result.status]));
const messageOf = (run: ImportRun, handle: string) => run.results.find((result) => result.handle === handle)!.message;
const createdIds = (studio: ReturnType<typeof fakeStudio>) => studio.create.mock.calls.map(([doc]) => doc._id);
const retryable = (run: ImportRun) => new Set(run.results.filter((result) => result.retryable).map((result) => result.documentId));

describe("draft creation", () => {
  it("creates every importable product as a draft with client.create, never a published document", async () => {
    const { run, studio } = await setup(
      [
        bag({ images: "front.jpg", collections: "bags", supplier: "Lagos Leather" }),
        shoe("40", "S40"),
        shoe("41", "S41", { variant_available: "no" }),
        belt(),
      ],
      { files: [imageFile("front.jpg")] }
    );
    const result = await run();

    expect(result.stopped).toBeNull();
    expect(statuses(result)).toEqual({ bag: "created", shoe: "created", belt: "created" });
    expect(createdIds(studio)).toEqual(["drafts.product-bag", "drafts.product-shoe", "drafts.product-belt"]);
    expect([...studio.docs.keys()].filter((id) => id.startsWith("product-"))).toEqual([]);
    expect(result.uploads).toEqual({ uploaded: 1, reused: 0, failed: 0 });

    const draft = studio.docs.get("drafts.product-bag")!;
    expect(draft).toMatchObject({
      _type: "product",
      title: "Leather Bag",
      slug: { _type: "slug", current: "leather-bag" },
      status: "draft",
      supplier: { _type: "reference", _ref: "supplier-1" },
      collections: [{ _type: "reference", _ref: "collection-bags", _key: "collection-0" }],
      images: [{ _type: "image", _key: "image-0", asset: { _type: "reference", _ref: "image-frontjpg-1x1-png" } }],
    });
    expect(messageOf(result, "bag")).toBe("Created as drafts.product-bag.");
    // Every read used the raw perspective without the CDN.
    expect(studio.configs.every((config) => JSON.stringify(config) === '{"perspective":"raw","useCdn":false}')).toBe(true);
  });

  it("keeps variant keys and combination keys exactly as planned", async () => {
    const { run, studio, plan } = await setup([shoe("40", "S40"), shoe("41", "S41", { variant_available: "no" })]);
    await run();

    const variants = studio.docs.get("drafts.product-shoe")!.variants as Record<string, unknown>[];
    expect(variants).toEqual(JSON.parse(JSON.stringify(plan.products[0].fields.variants)));
    expect(variants.map((variant) => variant.available)).toEqual([true, false]);
  });

  it("creates a product with every variant unavailable, as the warning allows", async () => {
    const { run, preview, studio } = await setup([
      shoe("40", "S40", { variant_available: "no" }),
      shoe("41", "S41", { variant_available: "no" }),
    ]);
    expect(preview.products[0].outcome).toBe("warning");

    expect(statuses(await run())).toEqual({ shoe: "created" });
    expect((studio.docs.get("drafts.product-shoe")!.variants as { available: boolean }[]).map((v) => v.available)).toEqual([
      false,
      false,
    ]);
  });

  it("creates a product without images, uploading nothing", async () => {
    const { run, studio } = await setup([bag()]);
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created" });
    expect(studio.docs.get("drafts.product-bag")).not.toHaveProperty("images");
    expect(studio.upload).not.toHaveBeenCalled();
  });

  it("skips products the preview blocked, without touching them", async () => {
    const existing = productDoc("product-belt", { title: "Old Belt" });
    const { run, studio } = await setup([bag(), belt()], { docs: [existing] });
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created", belt: "skipped" });
    expect(messageOf(result, "belt")).toContain("Blocked in the Studio check: Already in the Studio");
    expect(createdIds(studio)).toEqual(["drafts.product-bag"]);
    expect(studio.docs.get("product-belt")).toEqual(existing);
  });

  it("never creates a product twice in one session", async () => {
    const { run, studio } = await setup([bag()]);
    await run();
    const second = await run();

    expect(second.results).toEqual([]);
    expect(studio.create).toHaveBeenCalledTimes(1);
  });

  it("checks permissions and the schema with the draft, before uploading", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    const order: string[] = [];
    vi.mocked(deps.checkPermission).mockImplementation(async (document) => {
      order.push(`permission ${document._id}`);
      return { granted: true, reason: "" };
    });
    vi.mocked(deps.validate).mockImplementation(async (document) => {
      order.push(`schema ${document._id} images:${"images" in document}`);
      return [];
    });
    studio.hooks.upload = () => void order.push("upload");
    studio.hooks.create = () => void order.push("create");
    await run();

    expect(order).toEqual([
      "permission drafts.product-bag",
      "schema drafts.product-bag images:false",
      "upload",
      "schema drafts.product-bag images:true",
      "create",
    ]);
  });

  it("fails a product the schema rejects, without uploading its images", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" }), belt()], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.validate).mockImplementation(async (document) =>
      document._id === "drafts.product-bag" ? [{ level: "error", message: "Required" }, { level: "warning", message: "Short" }] : []
    );
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed", belt: "created" });
    expect(messageOf(result, "bag")).toBe("Doesn't match the product schema: Required");
    expect(studio.upload).not.toHaveBeenCalled();
  });

  it("stops before anything is read or written when the preview doesn't match the plan", async () => {
    const { plan, images, preview, studio, session, deps } = await setup([bag(), belt()]);
    const result = await runDraftImport(
      { plan, images, preview: { ...preview, products: [...preview.products].reverse() }, session },
      deps
    );

    expect(result.stopped).toEqual({ reason: "check", message: "The Studio check doesn't match this spreadsheet. Run it again." });
    expect(studio.fetch).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
  });
});

describe("dataset safety", () => {
  it("refuses production even when the client and workspace agree", async () => {
    const { studio, plan, images, preview, session, deps } = await setup([bag()]);
    studio.state.dataset = "production";
    const result = await runDraftImport(
      { plan, images, preview, session },
      { ...deps, workspace: { projectId: "proj", dataset: "production" } }
    );

    expect(result.stopped?.reason).toBe("target");
    expect(result.stopped?.message).toContain("Imports into production aren't switched on");
    expect(statuses(result)).toEqual({ bag: "not-attempted" });
    expect(studio.fetch).not.toHaveBeenCalled();
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("refuses a client whose dataset or project differs from the workspace", async () => {
    const { studio, run } = await setup([bag()]);
    studio.state.dataset = "production";
    expect((await run()).stopped?.message).toContain('uses dataset "production", but this workspace is "development"');

    studio.state.dataset = "development";
    studio.state.projectId = "other";
    expect((await run()).stopped?.message).toContain('uses project "other"');
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("checks the dataset again before uploading", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.validate).mockImplementation(async () => {
      studio.state.dataset = "production";
      return [];
    });
    const result = await run();

    expect(result.stopped?.reason).toBe("target");
    expect(statuses(result)).toEqual({ bag: "not-attempted" });
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("checks the dataset again before every create", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.hooks.create = () => {
      studio.state.dataset = "production";
    };
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created", belt: "not-attempted" });
    expect(result.stopped?.reason).toBe("target");
    expect(studio.create).toHaveBeenCalledTimes(1);
  });
});

describe("permissions", () => {
  it("stops before uploading when the editor may not create drafts", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" }), belt()], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.checkPermission).mockResolvedValue({ granted: false, reason: "No create grant." });
    const result = await run();

    expect(result.stopped).toEqual({
      reason: "permission",
      message: "Your Sanity role can't create product drafts here, so nothing was uploaded or created.",
    });
    expect(statuses(result)).toEqual({ bag: "failed", belt: "not-attempted" });
    expect(messageOf(result, "bag")).toBe("Your Sanity role can't create this draft. No create grant.");
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("stops on a 403 while uploading, creating nothing", async () => {
    const { run, studio } = await setup([bag({ images: "front.jpg" }), belt()], { files: [imageFile("front.jpg")] });
    studio.hooks.upload = () => error(403, "Forbidden");
    const result = await run();

    expect(result.stopped).toEqual({ reason: "permission", message: "Sanity refused the request (403): Forbidden" });
    expect(statuses(result)).toEqual({ bag: "not-attempted", belt: "not-attempted" });
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("stops on a 401 while creating, reporting the products not attempted", async () => {
    const { run, studio } = await setup([bag(), belt(), shoe("40", "S40")]);
    studio.hooks.create = (doc) => (doc._id === "drafts.product-belt" ? error(401, "Session expired") : undefined);
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created", belt: "failed", shoe: "not-attempted" });
    expect(result.stopped?.reason).toBe("permission");
    expect(messageOf(result, "shoe")).toBe("Not attempted: the import stopped after a permission error.");
  });

  it("stops on a 403 from the last check before a create", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.hooks.fetch = (params) => (params.id === "product-belt" ? error(403, "Forbidden") : undefined);
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created", belt: "not-attempted" });
    expect(result.stopped?.reason).toBe("permission");
  });
});

describe("conflicts after the preview", () => {
  it("skips a product that was created elsewhere since the preview", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.docs.set("product-bag", productDoc("product-bag"));
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "skipped", belt: "created" });
    expect(messageOf(result, "bag")).toContain("Blocked since the Studio check: Already in the Studio");
  });

  it("fails a product whose slug is taken just before its create", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.hooks.fetch = (params) => {
      if (params.id === "product-belt") studio.docs.set("drafts.product-strap", productDoc("drafts.product-strap", { slug: { current: "Belt" } }));
    };
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "created", belt: "failed" });
    expect(messageOf(result, "belt")).toBe(
      'A conflict appeared after the check, so the draft wasn\'t created: The slug "belt" is already used by "Existing" (product-strap, draft).'
    );
    expect(createdIds(studio)).toEqual(["drafts.product-bag"]);
  });

  it("fails a product whose variant SKU is taken just before its create", async () => {
    const { run, studio } = await setup([shoe("40", "S40"), shoe("41", "S41")]);
    studio.hooks.fetch = (params) => {
      if (params.id === "product-shoe") studio.docs.set("product-boot", productDoc("product-boot", { variants: [{ sku: "s41" }] }));
    };
    const result = await run();

    expect(statuses(result)).toEqual({ shoe: "failed" });
    expect(messageOf(result, "shoe")).toContain('The SKU "S41" is already used by "Existing" (product-boot, published).');
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("fails a product published at the same ID just before its create", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.fetch = (params) => {
      if (params.id === "product-bag") studio.docs.set("product-bag", productDoc("product-bag", { title: "Live Bag" }));
    };
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed" });
    expect(messageOf(result, "bag")).toContain('Already in the Studio as "Live Bag" (product-bag, published)');
    expect(studio.docs.has("drafts.product-bag")).toBe(false);
  });

  it("finds a release version at the same ID just before its create", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.fetch = (params) => {
      if (params.id === "product-bag") studio.docs.set("versions.r1.product-bag", productDoc("versions.r1.product-bag"));
    };
    expect(statuses(await run())).toEqual({ bag: "failed" });
  });

  it("reports a draft created at the same moment, leaving it unchanged", async () => {
    const { run, studio } = await setup([bag()]);
    const theirs = productDoc("drafts.product-bag", { title: "Someone else's bag" });
    studio.hooks.create = (doc) => {
      if (doc._id === "drafts.product-bag") studio.docs.set(doc._id, theirs);
    };
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed" });
    expect(messageOf(result, "bag")).toBe(
      "A document with the ID drafts.product-bag was created after the check. Nothing was changed."
    );
    expect(studio.docs.get("drafts.product-bag")).toBe(theirs);
    expect(result.results[0].retryable).toBe(false);
  });

  it("skips a product whose collection was archived since the preview", async () => {
    const { run, studio } = await setup([bag({ collections: "bags" })]);
    studio.docs.set("collection-bags", collectionDoc("bags", "archived"));
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "skipped" });
    expect(messageOf(result, "bag")).toContain('The collection "bags" (bags) is archived.');
  });

  it("skips a product whose supplier was removed since the preview, never creating one", async () => {
    const { run, studio } = await setup([bag({ supplier: "Lagos Leather" })]);
    studio.docs.delete("supplier-1");
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "skipped" });
    expect(messageOf(result, "bag")).toContain('No supplier is named "Lagos Leather"');
    expect([...studio.docs.values()].some((doc) => doc._type === "supplier")).toBe(false);
  });
});

describe("images", () => {
  it("uploads an image shared by two products once, and both drafts use it", async () => {
    const { run, studio } = await setup([bag({ images: "shared.jpg" }), belt({ images: "shared.jpg, belt.jpg" })], {
      files: [imageFile("shared.jpg"), imageFile("belt.jpg", 1)],
    });
    const result = await run();

    expect(studio.upload).toHaveBeenCalledTimes(2);
    expect(result.uploads).toEqual({ uploaded: 2, reused: 0, failed: 0 });
    const refs = (id: string) => (studio.docs.get(id)!.images as { asset: { _ref: string } }[]).map((image) => image.asset._ref);
    expect(refs("drafts.product-bag")).toEqual(["image-sharedjpg-1x1-png"]);
    expect(refs("drafts.product-belt")).toEqual(["image-sharedjpg-1x1-png", "image-beltjpg-1x1-png"]);
  });

  it("fails only the products whose image didn't upload, reporting the unused asset, then retries reusing it", async () => {
    const { run, studio, session, images } = await setup(
      [bag({ images: "front.jpg, side.jpg" }), belt({ images: "belt.jpg" })],
      { files: [imageFile("front.jpg"), imageFile("side.jpg", 1), imageFile("belt.jpg", 2)] }
    );
    studio.hooks.upload = (filename) => (filename === "side.jpg" ? error(500, "Upload failed") : undefined);
    const first = await run();

    expect(statuses(first)).toEqual({ bag: "failed", belt: "created" });
    expect(messageOf(first, "bag")).toBe(
      "side.jpg couldn't be uploaded (Sanity answered 500: Upload failed), so the draft wasn't created."
    );
    expect(first.uploads).toEqual({ uploaded: 2, reused: 0, failed: 1 });
    expect(unusedAssets(session, images)).toEqual([{ filename: "front.jpg", assetId: "image-frontjpg-1x1-png" }]);

    studio.hooks.upload = undefined;
    studio.upload.mockClear();
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ bag: "created" });
    expect(studio.upload.mock.calls.map(([, , options]) => options.filename)).toEqual(["side.jpg"]);
    expect(retry.uploads).toEqual({ uploaded: 1, reused: 1, failed: 0 });
    expect(unusedAssets(session, images)).toEqual([]);
  });
});

describe("unclear and refused creates", () => {
  it("marks a create with no clear answer as unclear, then confirms it by reading it back", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.create = (doc) => {
      studio.docs.set(doc._id, structuredClone(doc));
      return error(502, "Bad gateway");
    };
    const first = await run();

    expect(statuses(first)).toEqual({ bag: "uncertain" });
    expect(messageOf(first, "bag")).toContain("The draft may or may not have been created");

    studio.hooks.create = undefined;
    const retry = await run({}, retryable(first));
    expect(statuses(retry)).toEqual({ bag: "created" });
    expect(messageOf(retry, "bag")).toBe(
      "Created as drafts.product-bag by the earlier attempt; confirmed by reading it back."
    );
    expect(studio.getDocument).toHaveBeenCalledWith("drafts.product-bag");
    expect(studio.create).toHaveBeenCalledTimes(1);
  });

  it("creates the draft on retry when reading back finds nothing", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.create = () => new Error("fetch failed");
    const first = await run();
    expect(statuses(first)).toEqual({ bag: "uncertain" });

    studio.hooks.create = undefined;
    const retry = await run({}, retryable(first));
    expect(statuses(retry)).toEqual({ bag: "created" });
    expect(studio.create).toHaveBeenCalledTimes(2);
  });

  it("never counts a different draft at the ID as its own", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.create = (doc) => {
      studio.docs.set(doc._id, { ...structuredClone(doc), title: "Changed by someone" });
      return new Error("socket hang up");
    };
    const first = await run();
    studio.hooks.create = undefined;
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ bag: "failed" });
    expect(messageOf(retry, "bag")).toBe("A different draft now exists at drafts.product-bag. It was left unchanged.");
    expect(studio.docs.get("drafts.product-bag")!.title).toBe("Changed by someone");
  });

  it("stays unclear when reading back fails too", async () => {
    const { run, studio, session } = await setup([bag()]);
    studio.hooks.create = () => new Error("offline");
    const first = await run();
    studio.hooks.getDocument = () => new Error("still offline");
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ bag: "uncertain" });
    expect(session.uncertain.has("product-bag")).toBe(true);
    expect(studio.create).toHaveBeenCalledTimes(1);
  });

  it("fails a refused create without retrying, and a rate-limited one as retryable", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.hooks.create = (doc) =>
      doc._id === "drafts.product-bag" ? error(400, "Invalid document") : error(429, "Too many requests");
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed", belt: "failed" });
    expect(messageOf(result, "bag")).toBe("Sanity refused the draft. Sanity answered 400: Invalid document");
    expect(result.results.map((entry) => entry.retryable)).toEqual([false, true]);
    expect(studio.docs.has("drafts.product-bag")).toBe(false);
  });
});

describe("cancellation", () => {
  it("stops between creates, keeping drafts already created", async () => {
    const { run, studio } = await setup([bag(), belt(), shoe("40", "S40")]);
    const result = await run({ shouldStop: () => studio.create.mock.calls.length >= 1 });

    expect(statuses(result)).toEqual({ bag: "created", belt: "not-attempted", shoe: "not-attempted" });
    expect(result.stopped).toEqual({ reason: "cancelled", message: "The import was stopped. Drafts created before then are kept." });
    expect(studio.docs.has("drafts.product-bag")).toBe(true);
  });

  it("stops before uploading anything when asked early", async () => {
    const { run, studio } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    const result = await run({ shouldStop: () => true });

    expect(result.stopped?.reason).toBe("cancelled");
    expect(statuses(result)).toEqual({ bag: "not-attempted" });
    expect(studio.upload).not.toHaveBeenCalled();
  });

  it("can finish a stopped import with a retry", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    const first = await run({ shouldStop: () => studio.create.mock.calls.length >= 1 });
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ belt: "created" });
    expect(createdIds(studio)).toEqual(["drafts.product-bag", "drafts.product-belt"]);
  });
});

describe("failures reading the Studio", () => {
  it("stops without writing when the dataset can't be read again", async () => {
    const { run, studio } = await setup([bag()]);
    studio.hooks.fetch = () => error(500, "Unavailable");
    const result = await run();

    expect(result.stopped).toEqual({
      reason: "check",
      message: "Couldn't reach Sanity to check existing products. Check your connection and try again.",
    });
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("fails one product, and carries on, when its last check can't be read", async () => {
    const { run, studio } = await setup([bag(), belt()]);
    studio.hooks.fetch = (params) => (params.id === "product-bag" ? error(500, "Unavailable") : undefined);
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed", belt: "created" });
    expect(messageOf(result, "bag")).toContain("Couldn't check for conflicts, so the draft wasn't created.");
  });
});

describe("the last-check query", () => {
  it("returns only products that could clash, in any state, ignoring case", async () => {
    const { BULK_IMPORT_PRODUCT_CHECK_QUERY } = await import("@/lib/sanity/queries");
    const dataset: Doc[] = [
      productDoc("product-bag"),
      productDoc("drafts.product-bag"),
      productDoc("versions.r1.product-bag"),
      productDoc("product-satchel", { slug: { current: "Leather-Bag" } }),
      productDoc("product-wallet", { baseSku: "b1" }),
      productDoc("product-boot", { variants: [{ sku: "X" }, { sku: "B2" }] }),
      productDoc("product-unrelated", { slug: { current: "hat" }, baseSku: "H1", variants: [{ sku: "H2" }] }),
      productDoc("product-bagged"),
      collectionDoc("bags"),
      collectionDoc("hats"),
      supplierDoc,
    ];
    const params = {
      id: "product-bag",
      draftId: "drafts.product-bag",
      versionPath: "versions.*.product-bag",
      slug: "leather-bag",
      skus: ["b1", "b2"],
      collectionSlugs: ["bags"],
    };
    const result = (await (await evaluate(parse(BULK_IMPORT_PRODUCT_CHECK_QUERY, { params }), { dataset, params })).get()) as {
      products: { _id: string }[];
      collections: { _id: string }[];
      suppliers: { _id: string }[];
    };

    expect(result.products.map((product) => product._id).sort()).toEqual([
      "drafts.product-bag",
      "product-bag",
      "product-boot",
      "product-satchel",
      "product-wallet",
      "versions.r1.product-bag",
    ]);
    expect(result.collections.map((collection) => collection._id)).toEqual(["collection-bags"]);
    expect(result.suppliers.map((supplier) => supplier._id)).toEqual(["supplier-1"]);
  });
});

describe("the fake client", () => {
  it("notices any use of a write method other than create and upload", () => {
    const { client } = fakeStudio([]);
    void (client as unknown as Record<string, unknown>).patch;
    void (client.assets as unknown as Record<string, unknown>).delete;

    expect(forbidden).toEqual(["client.patch", "client.assets.delete"]);
    forbidden.length = 0;
  });
});

describe("the finished draft", () => {
  it("is validated with its image assets, and isn't created when that fails", async () => {
    const { run, deps, studio, session, images } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.validate).mockImplementation(async (document) =>
      "images" in document ? [{ level: "error", message: "Reference to image-frontjpg-1x1-png is not published" }] : []
    );
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed" });
    expect(messageOf(result, "bag")).toBe(
      "The finished draft doesn't match the product schema, so it wasn't created: Reference to image-frontjpg-1x1-png is not published"
    );
    expect(studio.create).not.toHaveBeenCalled();
    const finished = vi.mocked(deps.validate).mock.calls.at(-1)![0];
    expect(finished.images).toEqual([
      { _type: "image", _key: "image-0", asset: { _type: "reference", _ref: "image-frontjpg-1x1-png" }, alt: "Leather Bag" },
    ]);
    expect(unusedAssets(session, images)).toEqual([{ filename: "front.jpg", assetId: "image-frontjpg-1x1-png" }]);
  });

  it("isn't created when its final validation can't run", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.validate).mockImplementation(async (document) => {
      if ("images" in document) throw new Error("offline");
      return [];
    });
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed" });
    expect(result.results[0].retryable).toBe(true);
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("isn't created when Sanity's upload answer isn't an image asset", async () => {
    const { run, studio } = await setup([bag({ images: "front.jpg" }), belt()], { files: [imageFile("front.jpg")] });
    studio.hooks.assetId = () => "file-front-pdf";
    const result = await run();

    expect(statuses(result)).toEqual({ bag: "failed", belt: "created" });
    expect(messageOf(result, "bag")).toBe(
      "front.jpg couldn't be uploaded (Sanity answered with something that isn't an image asset.), so the draft wasn't created."
    );
    expect(createdIds(studio)).toEqual(["drafts.product-belt"]);
  });

  it("is created only if the dataset is still right after the final validation", async () => {
    const { run, deps, studio } = await setup([bag({ images: "front.jpg" })], { files: [imageFile("front.jpg")] });
    vi.mocked(deps.validate).mockImplementation(async (document) => {
      if ("images" in document) studio.state.dataset = "production";
      return [];
    });
    const result = await run();

    expect(result.stopped?.reason).toBe("target");
    expect(studio.create).not.toHaveBeenCalled();
  });
});

describe("reading back an unclear create", () => {
  const unclear = (studio: ReturnType<typeof fakeStudio>, change: (doc: Doc) => Doc) => {
    studio.hooks.create = (doc) => {
      studio.docs.set(doc._id, change(structuredClone(doc)));
      return error(504, "Gateway timeout");
    };
  };
  const asSanityReturnsIt = (doc: Doc): Doc => ({
    _rev: "r1",
    _createdAt: "2026-10-27T10:00:00Z",
    _updatedAt: "2026-10-27T10:00:00Z",
    ...(Object.fromEntries(Object.entries(doc).reverse()) as Doc),
  });

  it("confirms its own draft whatever system fields Sanity added", async () => {
    const { run, studio } = await setup([shoe("40", "S40", { images: "shoe.jpg" }), shoe("41", "S41", { variant_available: "no" })], {
      files: [imageFile("shoe.jpg")],
    });
    unclear(studio, asSanityReturnsIt);
    const first = await run();
    const stored = studio.docs.get("drafts.product-shoe");
    studio.hooks.create = undefined;
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ shoe: "created" });
    expect(messageOf(retry, "shoe")).toBe("Created as drafts.product-shoe by the earlier attempt; confirmed by reading it back.");
    expect(studio.create).toHaveBeenCalledTimes(1);
    expect(studio.docs.get("drafts.product-shoe")).toBe(stored);
  });

  it("confirms it after an editor added fields, saying so", async () => {
    const { run, studio } = await setup([bag()]);
    unclear(studio, (doc) => ({ ...asSanityReturnsIt(doc), category: "Bags" }));
    const retry = await run({}, retryable(await run()));

    expect(messageOf(retry, "bag")).toBe(
      "Created as drafts.product-bag by the earlier attempt; confirmed by reading it back. It has since been edited (category)."
    );
  });

  it("rejects a draft whose variants differ, leaving it as it is", async () => {
    const { run, studio } = await setup([shoe("40", "S40"), shoe("41", "S41", { variant_available: "no" })]);
    unclear(studio, (doc) => ({
      ...asSanityReturnsIt(doc),
      variants: (doc.variants as Record<string, unknown>[]).map((variant) => ({ ...variant, available: true })),
    }));
    const first = await run();
    const stored = studio.docs.get("drafts.product-shoe");
    studio.hooks.create = undefined;
    const retry = await run({}, retryable(first));

    expect(statuses(retry)).toEqual({ shoe: "failed" });
    expect(messageOf(retry, "shoe")).toBe("A different draft now exists at drafts.product-shoe. It was left unchanged.");
    expect(studio.docs.get("drafts.product-shoe")).toBe(stored);
    expect(studio.create).toHaveBeenCalledTimes(1);
  });
});

describe("runDraftPreflight", () => {
  it("runs every check without uploading or creating anything", async () => {
    const { plan, images, preview, studio, deps } = await setup(
      [bag({ images: "front.jpg", collections: "bags", supplier: "Lagos Leather" }), belt(), shoe("40", "S40", { images: "front.jpg" })],
      { docs: [productDoc("product-belt")], files: [imageFile("front.jpg")] }
    );
    const result = await runDraftPreflight({ plan, images, preview }, deps);

    expect(result.stopped).toBeNull();
    expect(result.products.map(({ handle, status }) => [handle, status])).toEqual([
      ["bag", "ready"],
      ["belt", "skipped"],
      ["shoe", "ready"],
    ]);
    expect(result.uploads).toEqual({ images: 1, bytes: 64 });
    expect(studio.create).not.toHaveBeenCalled();
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.getDocument).not.toHaveBeenCalled();

    // Permission and schema were checked on the complete draft, with a placeholder for the image.
    const checked = vi.mocked(deps.checkPermission).mock.calls.map(([document]) => document);
    expect(checked.map((document) => document._id)).toEqual(["drafts.product-bag", "drafts.product-shoe"]);
    expect(checked[0]).toMatchObject({
      supplier: { _ref: "supplier-1" },
      collections: [{ _ref: "collection-bags" }],
      images: [{ asset: { _ref: "image-0000000000000000000000000000000000000000-1x1-png" } }],
    });
    const [, options] = vi.mocked(deps.validate).mock.calls[0];
    const exists = (id: string) => options!.getDocumentExists!({ id });
    expect(await exists("image-0000000000000000000000000000000000000000-1x1-png")).toBe(true);
    expect(await exists("collection-bags")).toBe(true);
    expect(await exists("supplier-1")).toBe(true);
    expect(await exists("image-other-1x1-png")).toBe(false);
    expect(await exists("drafts.product-belt")).toBe(false);
  });

  it("reports products the editor can't create, and schema problems", async () => {
    const { plan, images, preview, studio, deps } = await setup([bag(), belt()]);
    vi.mocked(deps.checkPermission).mockImplementation(async (document) =>
      document._id === "drafts.product-bag" ? { granted: false, reason: "No create grant." } : { granted: true, reason: "" }
    );
    vi.mocked(deps.validate).mockResolvedValue([{ level: "error", message: "Required" }]);
    const result = await runDraftPreflight({ plan, images, preview }, deps);

    expect(result.products.map(({ status, message }) => [status, message])).toEqual([
      ["failed", "Your Sanity role can't create this draft. No create grant."],
      ["failed", "Doesn't match the product schema: Required"],
    ]);
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("skips products that became blocked since the preview", async () => {
    const { plan, images, preview, studio, deps } = await setup([bag()]);
    studio.docs.set("drafts.product-bag", productDoc("drafts.product-bag"));
    const result = await runDraftPreflight({ plan, images, preview }, deps);

    expect(result.products[0]).toMatchObject({ status: "skipped" });
    expect(result.products[0].message).toContain("Already in the Studio");
  });

  it("refuses production and mismatched datasets before reading anything", async () => {
    const { plan, images, preview, studio, deps } = await setup([bag()]);
    studio.state.dataset = "production";
    const result = await runDraftPreflight({ plan, images, preview }, { ...deps, workspace: { projectId: "proj", dataset: "production" } });

    expect(result.stopped?.reason).toBe("target");
    expect(studio.fetch).not.toHaveBeenCalled();
    expect(deps.checkPermission).not.toHaveBeenCalled();
  });
});

describe("the proposed first live test", () => {
  it("reads as three valid products from the template's columns, uploading two unique images", async () => {
    const csv = toCsv(COLUMN_NAMES, FIRST_LIVE_TEST_ROWS.map((row) => COLUMN_NAMES.map((column) => row[column] ?? "")));
    const plan = buildImportPlan(await readSpreadsheet(new File([csv], "zz-test-products.csv")));
    // The only note is the expected one: the tote has no images.
    expect(plan.issues.map(({ severity, handle, column }) => [severity, handle, column])).toEqual([
      ["warning", "zz-test-tote", "images"],
    ]);
    expect(plan.summary).toMatchObject({ products: 3, simpleProducts: 2, variantProducts: 1, variants: 2, errors: 0 });

    const pngs = Object.entries(FIRST_LIVE_TEST_IMAGES).map(([name, colour]) => ({ name, bytes: solidPng([...colour]) }));
    const hashes = pngs.map(({ bytes }) => createHash("sha256").update(bytes).digest("hex"));
    expect(new Set(hashes).size).toBe(2);
    const library = await buildImageLibrary(pngs.map(({ name, bytes }) => new File([bytes], name)));
    expect(library.issues).toEqual([]);
    expect(library.stats).toMatchObject({ images: 2, skipped: 0 });

    const images = matchImages(plan, library);
    expect(images.unused).toEqual([]);
    const studio = fakeStudio([]);
    const preview = resolveImport(plan, images, await fetchSanityIndex(studio.client));
    expect(preview.products.map(({ handle, outcome }) => [handle, outcome])).toEqual([
      ["zz-test-mug", "ready"],
      ["zz-test-tote", "warning"],
      ["zz-test-sock", "ready"],
    ]);
    expect(preview.summary).toMatchObject({ uploadImages: 2, sharedImages: 1 });

    const result = await runDraftImport(
      { plan, images, preview, session: createImportSession() },
      {
        client: studio.client,
        workspace: { projectId: "proj", dataset: "development" },
        checkPermission: async () => ({ granted: true, reason: "" }),
        validate: async () => [],
      }
    );
    expect(result.results.map(({ draftId, status }) => [draftId, status])).toEqual([
      ["drafts.product-zz-test-mug", "created"],
      ["drafts.product-zz-test-tote", "created"],
      ["drafts.product-zz-test-sock", "created"],
    ]);
    expect(studio.upload.mock.calls.map(([, , options]) => options.filename).sort()).toEqual([
      "zz-test-mug.png",
      "zz-test-sock-red.png",
    ]);

    const mug = studio.docs.get("drafts.product-zz-test-mug")!;
    const tote = studio.docs.get("drafts.product-zz-test-tote")!;
    const sock = studio.docs.get("drafts.product-zz-test-sock")!;
    const refs = (doc: Doc) => (doc.images as { asset: { _ref: string } }[]).map((image) => image.asset._ref);
    expect(refs(sock)).toEqual(refs(mug));
    expect(tote).not.toHaveProperty("images");
    expect(sock.variants).toEqual([
      {
        ...JSON.parse(JSON.stringify(plan.products[2].fields.variants![0])),
        image: { _type: "image", asset: { _type: "reference", _ref: "image-zztestsockredpng-1x1-png" } },
      },
      JSON.parse(JSON.stringify(plan.products[2].fields.variants![1])),
    ]);
    expect((sock.variants as { combinationKey: string; available: boolean }[]).map((v) => [v.combinationKey, v.available])).toEqual([
      ["colour:red", true],
      ["colour:blue", false],
    ]);
    for (const doc of [mug, tote, sock]) {
      expect(doc).toMatchObject({ status: "draft" });
      expect(doc).not.toHaveProperty("supplier");
      expect(doc).not.toHaveProperty("collections");
    }
  });
});
