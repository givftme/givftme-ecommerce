// @vitest-environment jsdom
import { studioTheme, ThemeProvider } from "@sanity/ui";
import { zipSync } from "fflate";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BulkImportTool } from "@/sanity/tools/bulk-import/BulkImportTool";
import { COLUMN_NAMES, type ColumnName } from "@/sanity/tools/bulk-import/columns";
import { buildImageLibrary } from "@/sanity/tools/bulk-import/images";
import { imageBytes, imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

// The Studio's hooks need a running Studio, so they're replaced. The client
// can read, create documents and upload assets, all mocked; it has no patch,
// replace, delete or publish methods, so any other write would throw.
const studio = vi.hoisted(() => ({
  dataset: "development",
  clientDataset: "development",
  roles: ["administrator"],
  permission: { granted: true, reason: "" },
  /** When set, answers each permission check from the permission and the document. */
  permissionFor: null as null | ((permission: string, document: { _id: string }) => { granted: boolean; reason: string }),
  useClient: vi.fn(),
  withConfig: vi.fn(),
  fetch: vi.fn(),
  create: vi.fn(),
  action: vi.fn(),
  upload: vi.fn(),
  getDocument: vi.fn(),
  validate: vi.fn(),
}));

vi.mock("sanity", async () => {
  // The Studio bundle doesn't load in jsdom; it re-exports this ID helper from the client.
  const { getPublishedId } = await import("@sanity/client/csm");
  const client = {
    config: () => ({ dataset: studio.clientDataset, projectId: "test-project" }),
    withConfig: (config: unknown) => {
      studio.withConfig(config);
      return { fetch: studio.fetch };
    },
    // Sanity's Actions API: each create action's draft goes through `studio.create`.
    action: async (input: unknown) => {
      studio.action(input);
      for (const entry of [input].flat() as { actionType: string; attributes?: unknown }[]) {
        if (entry.actionType === "sanity.action.document.create") await studio.create(entry.attributes);
      }
      return { transactionId: "tx" };
    },
    getDocument: (id: string) => studio.getDocument(id),
    assets: { upload: (...args: unknown[]) => studio.upload(...args) },
  };
  const grants = {
    checkDocumentPermission: (permission: string, document: { _id: string }) => ({
      subscribe: (observer: { next: (value: unknown) => void }) => {
        observer.next(studio.permissionFor ? studio.permissionFor(permission, document) : studio.permission);
        return { unsubscribe: () => undefined };
      },
    }),
  };
  return {
    getPublishedId,
    useCurrentUser: () => ({ roles: studio.roles.map((name) => ({ name })) }),
    useDataset: () => studio.dataset,
    useProjectId: () => "test-project",
    useGrantsStore: () => grants,
    useWorkspace: () => ({ name: "default" }),
    validateDocument: (options: unknown) => studio.validate(options),
    useClient: (options: unknown) => {
      studio.useClient(options);
      return client;
    },
  };
});

// sanity/env.ts throws without Sanity env vars, and the query module pulls in next-sanity.
vi.mock("@/sanity/env", () => ({ apiVersion: "2026-07-09", dataset: "development", projectId: "test-project" }));
vi.mock("@/lib/sanity/queries", () => ({
  BULK_IMPORT_INDEX_QUERY: "BULK_IMPORT_INDEX_QUERY",
  BULK_IMPORT_PRODUCT_CHECK_QUERY: "BULK_IMPORT_PRODUCT_CHECK_QUERY",
}));

// The real image reader, wrapped so one test can make it fail.
vi.mock("@/sanity/tools/bulk-import/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/sanity/tools/bulk-import/images")>();
  return { ...actual, buildImageLibrary: vi.fn(actual.buildImageLibrary) };
});

// Rendering the Studio's UI library in jsdom is slow when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

type RowInput = Partial<Record<ColumnName, string>>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  studio.dataset = "development";
  studio.clientDataset = "development";
  studio.fetch.mockReset();
  studio.fetch.mockResolvedValue({ products: [], collections: [], suppliers: [] });
  studio.roles = ["administrator"];
  studio.permission = { granted: true, reason: "" };
  studio.permissionFor = null;
  studio.action.mockReset();
  studio.create.mockReset();
  studio.create.mockImplementation(async (document: unknown) => document);
  studio.upload.mockReset();
  studio.upload.mockImplementation(async (_type: string, _blob: Blob, { filename }: { filename: string }) => ({
    _id: `image-${filename.replace(/\W/g, "")}-64x64-jpg`,
  }));
  studio.getDocument.mockReset();
  studio.getDocument.mockResolvedValue(undefined);
  studio.validate.mockReset();
  studio.validate.mockResolvedValue([]);
  // Node's File and Blob can be read and streamed, as a browser's can.
  vi.stubGlobal("File", NodeFile);
  vi.stubGlobal("Blob", NodeBlob);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderTool() {
  await act(async () => root.render(createElement(ThemeProvider, { theme: studioTheme }, createElement(BulkImportTool))));
}

function spreadsheet(name: string, ...rows: RowInput[]) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [COLUMN_NAMES.join(","), ...rows.map((row) => COLUMN_NAMES.map((column) => cell(row[column] ?? "")).join(","))];
  return new File([lines.join("\n")], name);
}

const bag = (overrides: RowInput = {}): RowInput => ({ handle: "bag", title: "Leather Bag", price: "30000", ...overrides });

const input = (selector: string) => container.querySelector<HTMLInputElement>(selector)!;
const spreadsheetInput = () => input('input[accept^=".csv"]');
const imagesInput = () => input('input[accept^=".jpg"]');
const folderInput = () => input("input[webkitdirectory]");

async function choose(target: HTMLInputElement, files: File[]) {
  await act(async () => {
    Object.defineProperty(target, "files", { configurable: true, value: files });
    target.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label || element.getAttribute("aria-label") === label
  );
  if (!found) throw new Error(`No "${label}" button`);
  return found;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

const text = () => container.textContent ?? "";
const previews = () => [...container.querySelectorAll("img")].map((image) => image.alt);

/** Reading files is asynchronous; retry until the screen catches up. */
async function waitFor(check: () => void, timeout = 10_000) {
  const started = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() - started > timeout) throw error;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
  }
}

async function loadSpreadsheet(...rows: RowInput[]) {
  await choose(spreadsheetInput(), [spreadsheet("products.csv", ...rows)]);
  await waitFor(() => expect(text()).toMatch(/passed validation|need fixing before import/));
}

describe("choosing images", () => {
  it("asks for a spreadsheet before images can be matched", async () => {
    await renderTool();
    expect(text()).toContain("Dataset: development");
    expect(text()).toContain("Choose a spreadsheet first, so images can be matched to its products.");
  });

  it("matches chosen images to the spreadsheet's products and previews them", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg, side.jpg" }));
    expect(text()).toContain("Every product passed validation");

    await choose(imagesInput(), [imageFile("front.jpg"), imageFile("side.jpg", 1)]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));
    expect(text()).toContain("2 usable images from 2 files");
    expect(previews()).toEqual(["front.jpg", "side.jpg"]);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("reports missing images, then finds them in a ZIP", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg, side.jpg" }));

    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("1 product needs image fixes"));
    expect(text()).toContain("side.jpg wasn't among the chosen images.");
    expect(text()).toContain("Needs images");

    const zip = new File([zipSync({ "photos/side.jpg": imageBytes("jpg", 1) })], "photos.zip");
    await choose(imagesInput(), [zip]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));
    expect(previews()).toEqual(["front.jpg", "side.jpg"]);
  });

  it("reads a chosen folder, skipping files that aren't images", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));

    const notes = new File(["notes"], "notes.txt");
    const front = imageFile("front.jpg");
    Object.defineProperty(notes, "webkitRelativePath", { value: "bag/notes.txt" });
    Object.defineProperty(front, "webkitRelativePath", { value: "bag/front.jpg" });
    await choose(folderInput(), [notes, front]);

    await waitFor(() => expect(text()).toContain("Every listed image was found"));
    expect(text()).toContain("notes.txt isn't a JPG, PNG, WebP or ZIP file and was skipped.");
    expect(previews()).toEqual(["front.jpg"]);
  });

  it("clears chosen images and their matches", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));
    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));

    await click("Clear images");
    expect(text()).not.toContain("Every listed image was found");
    expect(text()).not.toContain("usable image");
    expect(previews()).toEqual([]);
  });
});

describe("changing the spreadsheet", () => {
  it("matches the chosen images against a new spreadsheet without choosing them again", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));
    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));

    await choose(spreadsheetInput(), [spreadsheet("corrected.csv", bag({ images: "front.jpg, back.jpg" }))]);
    await waitFor(() => expect(text()).toContain("1 product needs image fixes"));
    expect(text()).toContain("back.jpg wasn't among the chosen images.");
    expect(buildImageLibrary).toHaveBeenCalledTimes(1);
  });

  it("keeps chosen images when the spreadsheet is removed, and lets them be cleared", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));
    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));

    await click("Clear spreadsheet");
    expect(text()).toContain("Choose a spreadsheet first");
    expect(text()).toContain("1 file is still chosen and will be matched to the next spreadsheet.");

    await click("Clear images");
    expect(text()).not.toContain("still chosen");

    await loadSpreadsheet(bag({ images: "front.jpg" }));
    expect(text()).not.toContain("usable image");
    expect(previews()).toEqual([]);
  });

  it("starts the previews from the first page again", async () => {
    const products = Array.from({ length: 25 }, (_, index) => bag({ handle: `p${index}`, title: `Product ${index}` }));
    await renderTool();
    await loadSpreadsheet(...products);
    await choose(imagesInput(), [imageFile("other.jpg")]);
    await waitFor(() => expect(text()).toContain("Show more (5 left)"));

    await click("Show more (5 left)");
    expect(text()).not.toContain("Show more");

    await loadSpreadsheet(...products);
    expect(text()).toContain("Show more (5 left)");
  });

  it("says when no products passed validation, rather than that every image was found", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ price: "", images: "front.jpg" }));
    expect(text()).toContain("1 product need fixing before import");

    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("No products passed spreadsheet validation"));
    expect(text()).not.toContain("Every listed image was found");
  });
});

describe("errors", () => {
  it("shows an error when images can't be read, and recovers on the next choice", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("disk unavailable");
    vi.mocked(buildImageLibrary).mockRejectedValueOnce(failure);
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));

    await choose(imagesInput(), [imageFile("other.jpg")]);
    await waitFor(() => expect(text()).toContain("Couldn't read those files. Try choosing them again."));
    expect(consoleError).toHaveBeenCalledWith("Bulk import: couldn't read the chosen images", failure);
    expect(previews()).toEqual([]);

    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("Every listed image was found"));
    expect(text()).not.toContain("Couldn't read those files");
  });

  it("explains a spreadsheet it can't read, leaving images waiting for one", async () => {
    await renderTool();
    await choose(spreadsheetInput(), [new File(["legacy"], "old.xls")]);
    await waitFor(() => expect(text()).toContain("Old .xls workbooks aren't supported."));
    expect(text()).toContain("Choose a spreadsheet first");
  });
});

type Index = { products: unknown[]; collections: unknown[]; suppliers: unknown[] };

const existingBelt: Index = {
  products: [{ _id: "product-belt", title: "Old Belt", slug: "belt", baseSku: null, variantSkus: null }],
  collections: [],
  suppliers: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const CHECK = "Check against the Studio";
const STALE = "changed since the last check";
const checkButton = () => button(CHECK) as HTMLButtonElement;
/** Each Step 4 product card's title, with its outcome. */
const productResults = () =>
  Object.fromEntries(
    [...container.querySelectorAll("[data-outcome]")].map((card) => [
      card.querySelector("[data-ui='Text']")?.textContent ?? "",
      card.getAttribute("data-outcome"),
    ])
  );

/** Starts a check and waits for its answer, whatever it is. */
async function checkStudio() {
  await click(CHECK);
  await waitFor(() => expect(text()).not.toMatch(/Checking \d+ products? against/));
}

describe("checking against the Studio", () => {
  it("reads from the workspace's dataset with the Studio client, without fetching until asked", async () => {
    await renderTool();
    expect(text()).toContain("Choose a spreadsheet first.");

    await loadSpreadsheet(bag());
    expect(text()).toContain("Reads dataset: development");
    expect(text()).toContain("Nothing has been uploaded or saved");
    expect(studio.useClient).toHaveBeenCalledWith({ apiVersion: "2026-07-09" });
    expect(studio.fetch).not.toHaveBeenCalled();
  });

  it("marks products ready, warning or blocked, explaining each and previewing what would be imported", async () => {
    studio.fetch.mockResolvedValue(existingBelt);
    await renderTool();
    await loadSpreadsheet(
      bag({ images: "front.jpg" }),
      bag({ handle: "belt", title: "Belt" }),
      bag({ handle: "hat", title: "Hat" }),
      bag({ handle: "scarf", title: "Scarf", price: "" })
    );
    await choose(imagesInput(), [imageFile("front.jpg")]);
    await waitFor(() => expect(text()).toContain("usable image"));

    await checkStudio();
    expect(studio.withConfig).toHaveBeenCalledWith({ perspective: "raw", useCdn: false });
    expect(studio.fetch).toHaveBeenCalledTimes(1);
    expect(studio.fetch).toHaveBeenCalledWith("BULK_IMPORT_INDEX_QUERY");

    expect(text()).toContain("2 of 3 products can be imported");
    expect(text()).toContain("1 ready · 1 with warnings · 1 blocked (1 already in the Studio)");
    expect(text()).toContain("1 more product failed spreadsheet validation and isn't included.");
    expect(text()).toContain("The importable products use 1 image file (64 bytes)");
    expect(text()).toContain("Checked against development at");
    expect(productResults()).toEqual({ Belt: "blocked", Hat: "warning", "Leather Bag": "ready" });
    expect(text()).toContain('Already in the Studio as "Old Belt" (product-belt, published)');
    expect(text()).toContain("It has no gallery images, so it will show without a photo.");
    expect(text()).toContain("Images:front.jpg");
    expect(text()).toContain("Supplier:None");
  });

  it("with no images chosen, blocks only products that list images", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }), bag({ handle: "belt", title: "Belt" }));
    expect(text()).toContain("No images are chosen.");

    await checkStudio();
    expect(productResults()).toEqual({ "Leather Bag": "blocked", Belt: "warning" });
    expect(text()).toContain("Some of its images are missing or ambiguous; see Choose images.");
  });

  it("explains a failed read, and recovers on the next check", async () => {
    studio.fetch.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
    await renderTool();
    await loadSpreadsheet(bag());

    await checkStudio();
    expect(text()).toContain("Your Sanity session can't read this dataset.");
    expect(productResults()).toEqual({});

    await checkStudio();
    expect(text()).not.toContain("Your Sanity session can't read this dataset.");
    expect(productResults()).toEqual({ "Leather Bag": "warning" });
  });

  it("says something went wrong when the response can't be used, logging the cause", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    studio.fetch.mockResolvedValueOnce({ products: [{ _id: 42 }] });
    await renderTool();
    await loadSpreadsheet(bag());

    await checkStudio();
    expect(text()).toContain("Something went wrong while checking. Try again.");
    expect(consoleError).toHaveBeenCalledWith(
      "Bulk import: couldn't check the spreadsheet against the Studio",
      expect.any(Error)
    );
  });
});

describe("keeping Studio results current", () => {
  it("sets results aside when the spreadsheet changes, until checked again", async () => {
    await renderTool();
    await loadSpreadsheet(bag());
    await checkStudio();
    expect(productResults()).toEqual({ "Leather Bag": "warning" });

    await loadSpreadsheet(bag({ title: "Suede Bag" }));
    expect(text()).toContain(STALE);
    expect(productResults()).toEqual({});
    expect(checkButton().disabled).toBe(false);

    await checkStudio();
    expect(text()).not.toContain(STALE);
    expect(productResults()).toEqual({ "Suede Bag": "warning" });
    expect(studio.fetch).toHaveBeenCalledTimes(2);
  });

  it("sets results aside when the spreadsheet is removed", async () => {
    await renderTool();
    await loadSpreadsheet(bag());
    await checkStudio();

    await click("Clear spreadsheet");
    expect(productResults()).toEqual({});
    await loadSpreadsheet(bag());
    expect(text()).toContain(STALE);
    expect(productResults()).toEqual({});
  });

  it("sets results aside while images are read and after they change, and waits for them", async () => {
    await renderTool();
    await loadSpreadsheet(bag({ images: "front.jpg" }));
    await checkStudio();
    expect(productResults()).toEqual({ "Leather Bag": "blocked" });

    const library = await buildImageLibrary([imageFile("front.jpg")]);
    const reading = deferred<typeof library>();
    vi.mocked(buildImageLibrary).mockReturnValueOnce(reading.promise);
    await choose(imagesInput(), [imageFile("front.jpg")]);
    expect(text()).toContain("Waiting for the chosen images to finish reading.");
    expect(checkButton().disabled).toBe(true);
    expect(productResults()).toEqual({});

    await act(async () => reading.resolve(library));
    await waitFor(() => expect(text()).toContain(STALE));
    expect(checkButton().disabled).toBe(false);

    await checkStudio();
    expect(productResults()).toEqual({ "Leather Bag": "ready" });

    await click("Clear images");
    expect(text()).toContain(STALE);
    expect(productResults()).toEqual({});
  });

  it("sets results aside when the dataset changes", async () => {
    await renderTool();
    await loadSpreadsheet(bag());
    await checkStudio();

    studio.dataset = "staging";
    studio.clientDataset = "staging";
    await renderTool();
    expect(text()).toContain("Reads dataset: staging");
    expect(text()).toContain(STALE);
    expect(productResults()).toEqual({});
  });

  it("ignores an earlier check that answers after a later one", async () => {
    const first = deferred<Index>();
    const second = deferred<Index>();
    studio.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderTool();
    await loadSpreadsheet(bag());

    await click(CHECK);
    expect(text()).toContain("Checking 1 product against development…");
    expect(checkButton().disabled).toBe(true);

    await loadSpreadsheet(bag({ title: "Suede Bag" }));
    await click(CHECK);

    await act(async () => second.resolve({ products: [], collections: [], suppliers: [] }));
    await waitFor(() => expect(productResults()).toEqual({ "Suede Bag": "warning" }));

    // The first answer says the product exists; it must not replace the newer result.
    await act(async () => first.resolve({ products: [{ _id: "product-bag", title: "Old" }], collections: [], suppliers: [] }));
    expect(productResults()).toEqual({ "Suede Bag": "warning" });
    expect(text()).not.toContain("Already in the Studio");
  });

  it("ignores an earlier check that answers while a later one is still running", async () => {
    const first = deferred<Index>();
    const second = deferred<Index>();
    studio.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderTool();
    await loadSpreadsheet(bag());
    await click(CHECK);
    await loadSpreadsheet(bag({ title: "Suede Bag" }));
    await click(CHECK);

    await act(async () => first.resolve({ products: [], collections: [], suppliers: [] }));
    expect(text()).toContain("Checking 1 product against development…");
    expect(productResults()).toEqual({});

    await act(async () => second.reject(new Error("offline")));
    await waitFor(() => expect(text()).toContain("Couldn't reach Sanity"));
    expect(productResults()).toEqual({});
  });
});

describe("dataset safety", () => {
  it("refuses to check when the client and the workspace disagree about the dataset", async () => {
    studio.clientDataset = "production";
    await renderTool();
    await loadSpreadsheet(bag());

    expect(text()).toContain('The Studio client reads "production", but this workspace is "development".');
    expect(checkButton().disabled).toBe(true);
    await act(async () => checkButton().click());
    expect(studio.fetch).not.toHaveBeenCalled();
  });

  it("shows which dataset is read, flagging production", async () => {
    studio.dataset = "production";
    studio.clientDataset = "production";
    await renderTool();
    await loadSpreadsheet(bag());

    expect(text()).toContain("Reads dataset: production");
    expect(text()).toContain("This Studio writes to the production dataset");
  });
});

/** Each Step 5 result card's title, with its import status. */
const importResults = () =>
  Object.fromEntries(
    [...container.querySelectorAll("[data-import-status]")].map((card) => [
      card.querySelector("[data-ui='Text']")?.textContent ?? "",
      card.getAttribute("data-import-status"),
    ])
  );
const createdIds = () => studio.create.mock.calls.map(([document]) => (document as { _id: string })._id);
const hasButton = (label: string) => {
  try {
    button(label);
    return true;
  } catch {
    return false;
  }
};

/** Loads rows, optionally images, and runs the Studio check. */
async function readyToImport(rows: RowInput[], files: File[] = []) {
  await renderTool();
  await loadSpreadsheet(...rows);
  if (files.length) {
    await choose(imagesInput(), files);
    await waitFor(() => expect(text()).toContain("usable image"));
  }
  await checkStudio();
}

async function importDrafts(count: number) {
  const noun = count === 1 ? "product" : "products";
  await click(`Import ${count} ${noun} as drafts`);
  await click(`Create ${count} ${count === 1 ? "draft" : "drafts"}`);
  await waitFor(() => expect(text()).toMatch(/drafts? created in/));
}

describe("importing drafts", () => {
  it("waits for a Studio check that matches the spreadsheet", async () => {
    await renderTool();
    await loadSpreadsheet(bag());
    expect(text()).toContain("Run the Studio check in step 4 first.");
    expect(hasButton("Import 1 product as drafts")).toBe(false);

    await checkStudio();
    expect(hasButton("Import 1 product as drafts")).toBe(true);

    await loadSpreadsheet(bag({ title: "Suede Bag" }));
    expect(text()).toContain("Run the Studio check in step 4 first.");
    expect(hasButton("Import 1 product as drafts")).toBe(false);
  });

  it("creates drafts only after confirmation, uploading images first, then reports them", async () => {
    await readyToImport([bag({ images: "front.jpg" }), bag({ handle: "belt", title: "Belt" })], [imageFile("front.jpg")]);
    expect(text()).toContain('Creates 2 drafts in "development", uploading 1 image file (64 bytes) first.');

    await click("Import 2 products as drafts");
    expect(text()).toContain('Create 2 product drafts in the "development" dataset (project test-project)?');
    expect(studio.create).not.toHaveBeenCalled();

    await click("Create 2 drafts");
    await waitFor(() => expect(text()).toContain('2 drafts created in "development"'));
    expect(createdIds()).toEqual(["drafts.product-bag", "drafts.product-belt"]);
    expect(studio.upload).toHaveBeenCalledTimes(1);
    expect(studio.validate).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: { name: "default" }, environment: "studio" })
    );
    expect(importResults()).toEqual({ "Leather Bag": "created", Belt: "created" });
    expect(text()).toContain("Nothing was published, patched or deleted.");
    expect(hasButton("Import 2 products as drafts")).toBe(false);
  });

  it("checks permissions and the schema without uploading or creating anything", async () => {
    await readyToImport([bag({ images: "front.jpg" }), bag({ handle: "belt", title: "Belt" })], [imageFile("front.jpg")]);
    await click("Check permissions and schema (no changes)");
    await waitFor(() => expect(text()).toContain("Preflight: 2 ready · 0 failed · 0 skipped"));

    expect(text()).toContain("with 1 image (64 bytes) still to upload. Nothing was uploaded or saved.");
    expect(studio.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ _id: "drafts.product-bag" }),
        getDocumentExists: expect.any(Function),
      })
    );
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
    expect(studio.getDocument).not.toHaveBeenCalled();
  });

  it("shows what the preflight found", async () => {
    studio.permission = { granted: false, reason: "No create grant." };
    await readyToImport([bag()]);
    await click("Check permissions and schema (no changes)");
    await waitFor(() => expect(text()).toContain("Preflight: 0 ready · 1 failed · 0 skipped"));

    expect(text()).toContain("Leather Bag (failed): Your Sanity role can't create this draft. No create grant.");
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    await readyToImport([bag()]);
    await click("Import 1 product as drafts");
    await click("Cancel");

    expect(studio.create).not.toHaveBeenCalled();
    expect(hasButton("Import 1 product as drafts")).toBe(true);
  });

  it("ignores a second click on the confirmation", async () => {
    await readyToImport([bag()]);
    await click("Import 1 product as drafts");
    const confirm = button("Create 1 draft");
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    await waitFor(() => expect(text()).toContain("1 draft created"));

    expect(studio.create).toHaveBeenCalledTimes(1);
  });

  it("doesn't offer imports into production", async () => {
    studio.dataset = "production";
    studio.clientDataset = "production";
    await readyToImport([bag()]);

    expect(text()).toContain("Imports into production aren't switched on yet.");
    expect(hasButton("Import 1 product as drafts")).toBe(false);
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("doesn't offer imports to a read-only role", async () => {
    studio.roles = ["viewer"];
    await readyToImport([bag()]);

    expect(text()).toContain("Your role is read-only, so you can't import products.");
    expect(hasButton("Import 1 product as drafts")).toBe(false);
  });

  it("stops before uploading when the editor may not create drafts", async () => {
    studio.permission = { granted: false, reason: "No create grant." };
    await readyToImport([bag({ images: "front.jpg" })], [imageFile("front.jpg")]);
    await importDrafts(1);

    expect(text()).toContain("Your Sanity role can't create product drafts here, so nothing was uploaded or created.");
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.create).not.toHaveBeenCalled();
  });

  it("stops between products when asked, keeping what was created", async () => {
    const first = deferred<unknown>();
    studio.create.mockReturnValueOnce(first.promise);
    await readyToImport([bag(), bag({ handle: "belt", title: "Belt" })]);
    await click("Import 2 products as drafts");
    await click("Create 2 drafts");
    await waitFor(() => expect(text()).toContain("Creating drafts: 0 of 2"));

    await click("Stop");
    expect(text()).toContain("Stopping after the current step…");
    await act(async () => first.resolve({}));
    await waitFor(() => expect(text()).toContain("The import was stopped. Drafts created before then are kept."));

    expect(importResults()).toEqual({ "Leather Bag": "created", Belt: "not-attempted" });
    expect(studio.create).toHaveBeenCalledTimes(1);
    expect(hasButton("Retry 1 product")).toBe(true);
  });

  it("retries an unclear create after reading it back", async () => {
    studio.create.mockRejectedValueOnce(new Error("offline"));
    await readyToImport([bag()]);
    await importDrafts(1);
    expect(importResults()).toEqual({ "Leather Bag": "uncertain" });

    await click("Retry 1 product");
    await waitFor(() => expect(importResults()).toEqual({ "Leather Bag": "created" }));
    expect(studio.getDocument).toHaveBeenCalledWith("drafts.product-bag");
    expect(studio.create).toHaveBeenCalledTimes(2);
    expect(hasButton("Retry 1 product")).toBe(false);
  });

  it("reports uploaded images that no created draft uses, without deleting them", async () => {
    studio.create.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Invalid"), { statusCode: 400 });
    });
    await readyToImport([bag({ images: "front.jpg" })], [imageFile("front.jpg")]);
    await importDrafts(1);

    expect(importResults()).toEqual({ "Leather Bag": "failed" });
    expect(text()).toContain("1 uploaded image isn't used by any created draft");
    expect(text()).toContain("front.jpg (image-frontjpg-64x64-jpg). They stay in the media library; nothing is deleted.");
  });

  it("marks the report as earlier once the spreadsheet changes", async () => {
    await readyToImport([bag()]);
    await importDrafts(1);
    await loadSpreadsheet(bag({ title: "Suede Bag" }));

    expect(text()).toContain("This report is from an earlier check.");
    expect(text()).toContain("Run the Studio check in step 4 first.");
  });
});

const modeRadio = (value: "draft" | "publish") =>
  container.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!;
const goLiveTick = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]');
const actionTypes = () =>
  studio.action.mock.calls.map(([actions]) => (actions as { actionType: string }[]).map((entry) => entry.actionType));

async function choosePublish() {
  await act(async () => modeRadio("publish").click());
}

describe("publishing", () => {
  it("has drafts selected by default", async () => {
    await readyToImport([bag()]);

    expect(modeRadio("draft").checked).toBe(true);
    expect(modeRadio("publish").checked).toBe(false);
    expect(hasButton("Import 1 product as drafts")).toBe(true);
  });

  it("publishes only after the tick, when products would go live", async () => {
    await readyToImport(
      [bag({ status: "active", images: "front.jpg" }), bag({ handle: "belt", title: "Belt", status: "draft" })],
      [imageFile("front.jpg")]
    );
    await choosePublish();
    expect(text()).toContain('Creates and publishes 2 products in "development"');
    expect(text()).toContain("1 will be live on the storefront (status active) · 1 will be published but stay hidden");

    await click("Create and publish 2 products");
    expect(text()).toContain('Create and publish 2 products in the "development" dataset (project test-project)?');
    expect(text()).toContain("I understand 1 product will be visible on the storefront.");
    expect((button("Publish 2 products") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => button("Publish 2 products").click());
    expect(studio.action).not.toHaveBeenCalled();

    await act(async () => goLiveTick()!.click());
    expect((button("Publish 2 products") as HTMLButtonElement).disabled).toBe(false);
    await click("Publish 2 products");
    await waitFor(() => expect(text()).toContain('2 products published in "development"'));

    expect(actionTypes()).toEqual([
      ["sanity.action.document.create", "sanity.action.document.publish"],
      ["sanity.action.document.create", "sanity.action.document.publish"],
    ]);
    expect(importResults()).toEqual({ "Leather Bag": "published", Belt: "published" });
    expect(text()).toContain("Existing products were not changed, and nothing was deleted.");
  });

  it("needs no tick when nothing would go live", async () => {
    await readyToImport([bag({ status: "draft" })]);
    await choosePublish();
    await click("Create and publish 1 product");

    expect(goLiveTick()).toBeNull();
    expect((button("Publish 1 product") as HTMLButtonElement).disabled).toBe(false);
  });

  it("lists the warnings before publishing", async () => {
    await readyToImport([
      bag({ status: "active" }),
      { handle: "sock", title: "Sock", price: "500", status: "active", option1_name: "Size", option1_value: "S", variant_available: "no" },
    ]);
    await choosePublish();

    expect(text()).toContain("Leather Bag: Active with no images: it will be live on the storefront without a photo.");
    expect(text()).toContain("Sock: Every variant is unavailable: it will be live on the storefront but can't be bought.");
  });

  it("doesn't offer publishing to a role that can only create drafts", async () => {
    studio.roles = ["contributor"];
    await readyToImport([bag()]);

    expect(modeRadio("publish").disabled).toBe(true);
    expect(text()).toContain("Your role can create drafts but not publish them.");
    expect(hasButton("Import 1 product as drafts")).toBe(true);
  });

  it("stops before writing when the grants don't allow publishing", async () => {
    studio.permissionFor = (permission, document) =>
      permission === "create" && !document._id.startsWith("drafts.")
        ? { granted: false, reason: "No matching grants found" }
        : { granted: true, reason: "Matching grant" };
    await readyToImport([bag({ status: "draft", images: "front.jpg" })], [imageFile("front.jpg")]);
    await choosePublish();

    await click("Check permissions and schema (no changes)");
    await waitFor(() => expect(text()).toContain("Preflight: 0 ready · 1 failed · 0 skipped"));
    expect(text()).toContain(
      "Leather Bag (failed): Your Sanity role can't create and publish this product. Can't create the published document: No matching grants found"
    );

    await click("Create and publish 1 product");
    await click("Publish 1 product");
    await waitFor(() => expect(text()).toContain("Your Sanity role can't publish products here, so nothing was uploaded or created."));
    expect(studio.upload).not.toHaveBeenCalled();
    expect(studio.action).not.toHaveBeenCalled();
  });

  it("retries an unclear publish as a publish, after reading it back", async () => {
    studio.create.mockRejectedValueOnce(new Error("offline"));
    await readyToImport([bag({ status: "draft" })]);
    await choosePublish();
    await click("Create and publish 1 product");
    await click("Publish 1 product");
    await waitFor(() => expect(importResults()).toEqual({ "Leather Bag": "uncertain" }));

    await click("Retry 1 product");
    await waitFor(() => expect(importResults()).toEqual({ "Leather Bag": "published" }));
    expect(studio.getDocument.mock.calls.map(([id]) => id)).toEqual(["product-bag", "drafts.product-bag"]);
    expect(actionTypes()).toEqual([
      ["sanity.action.document.create", "sanity.action.document.publish"],
      ["sanity.action.document.create", "sanity.action.document.publish"],
    ]);
  });
});
