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

// The Studio's hooks need a running Studio; the tool only reads these two.
vi.mock("sanity", () => ({
  useCurrentUser: () => ({ roles: [{ name: "administrator" }] }),
  useDataset: () => "development",
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
