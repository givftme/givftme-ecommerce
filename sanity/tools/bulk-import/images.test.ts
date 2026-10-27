import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildImageLibrary,
  detectImageType,
  MAX_LIBRARY_IMAGES,
  type ImageLibrary,
} from "@/sanity/tools/bulk-import/images";
import { imageBytes, imageFile } from "@/sanity/tools/bulk-import/test-fixtures";

const zipFile = (name: string, files: Parameters<typeof zipSync>[0]) =>
  new File([zipSync(files) as BlobPart], name);

const messages = (library: ImageLibrary) =>
  library.issues.map(({ severity, message }) => ({ severity, message }));

describe("detectImageType", () => {
  it("recognises JPG, PNG and WebP by their first bytes", () => {
    expect(detectImageType(imageBytes("jpg"))).toBe("image/jpeg");
    expect(detectImageType(imageBytes("png"))).toBe("image/png");
    expect(detectImageType(imageBytes("webp"))).toBe("image/webp");
    expect(detectImageType(strToU8("GIF89a......"))).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
  });
});

describe("buildImageLibrary", () => {
  it("reads loose images and ZIP contents into one library keyed by filename", async () => {
    const library = await buildImageLibrary([
      imageFile("Front.JPG", 1),
      imageFile("side.png", 2),
      zipFile("photos.zip", { "bags/back.webp": imageBytes("webp", 3) }),
    ]);

    expect([...library.images.keys()]).toEqual(["front.jpg", "side.png", "back.webp"]);
    expect(library.images.get("front.jpg")).toMatchObject({
      filename: "Front.JPG",
      source: "Front.JPG",
      type: "image/jpeg",
      size: 64,
    });
    expect(library.images.get("back.webp")).toMatchObject({
      filename: "back.webp",
      source: "photos.zip › bags/back.webp",
      type: "image/webp",
    });
    expect(library.stats).toEqual({ files: 3, archives: 1, images: 3, skipped: 0 });
    expect(library.issues).toEqual([]);
  });

  it("uses the type found in the file, not the extension", async () => {
    const pngNamedJpg = new File([imageBytes("png")], "bag.jpg");
    const library = await buildImageLibrary([pngNamedJpg]);
    const image = library.images.get("bag.jpg")!;
    expect(image.type).toBe("image/png");
    expect(image.blob.type).toBe("image/png");
  });

  it("rejects empty, oversized and fake images, keeping the reason for matching", async () => {
    const library = await buildImageLibrary(
      [
        new File([], "empty.jpg"),
        imageFile("huge.jpg", 0, 2048),
        new File([strToU8("this is really a PDF")], "fake.jpg"),
        imageFile("fine.jpg"),
      ],
      { maxImageBytes: 1024 }
    );

    expect([...library.images.keys()]).toEqual(["fine.jpg"]);
    expect(Object.fromEntries(library.rejected)).toEqual({
      "empty.jpg": "empty.jpg is empty.",
      "huge.jpg": "huge.jpg is 2 KB; images can be up to 1 KB.",
      "fake.jpg": "fake.jpg isn't a real JPG, PNG or WebP image. It may be another format renamed, or damaged.",
    });
    expect(library.issues.every((issue) => issue.severity === "error")).toBe(true);
    expect(library.issues).toHaveLength(3);
  });

  it("skips unsupported files and OS files", async () => {
    const library = await buildImageLibrary([
      new File(["gif"], "logo.gif"),
      new File(["x"], ".DS_Store"),
      new File(["x"], "Thumbs.db"),
      imageFile("bag.jpg"),
    ]);
    expect([...library.images.keys()]).toEqual(["bag.jpg"]);
    expect(messages(library)).toEqual([
      { severity: "warning", message: "logo.gif isn't a JPG, PNG, WebP or ZIP file and was skipped." },
    ]);
    expect(library.stats).toEqual({ files: 2, archives: 0, images: 1, skipped: 1 });
  });

  it("treats two different files with the same name as a conflict, ignoring case and folders", async () => {
    const library = await buildImageLibrary([
      imageFile("Bag.jpg", 1),
      zipFile("photos.zip", { "summer/bag.JPG": imageBytes("jpg", 2) }),
    ]);

    expect(library.images.has("bag.jpg")).toBe(false);
    expect(library.conflicts.get("bag.jpg")).toEqual(["Bag.jpg", "photos.zip › summer/bag.JPG"]);
    expect(messages(library)).toEqual([
      {
        severity: "error",
        message:
          "2 different files are named Bag.jpg: Bag.jpg, photos.zip › summer/bag.JPG. Rename them so each name is used once.",
      },
    ]);
  });

  it("keeps one copy when the same file is chosen twice", async () => {
    const library = await buildImageLibrary([imageFile("bag.jpg", 1), imageFile("bag.jpg", 1)]);
    expect(library.images.has("bag.jpg")).toBe(true);
    expect(library.conflicts.size).toBe(0);
    expect(messages(library)).toEqual([
      { severity: "warning", message: "bag.jpg was chosen 2 times; the copies are identical, so one is used." },
    ]);
  });

  it("treats a usable and an unusable file with the same name as a conflict", async () => {
    const library = await buildImageLibrary([
      imageFile("bag.jpg", 1),
      new File([strToU8("not an image")], "BAG.jpg"),
    ]);
    expect(library.images.has("bag.jpg")).toBe(false);
    expect(library.conflicts.has("bag.jpg")).toBe(true);
  });

  it("reports ZIP problems, grouping skipped files by reason", async () => {
    const library = await buildImageLibrary(
      [
        zipFile("photos.zip", {
          "a.txt": strToU8("a"),
          "b.pdf": strToU8("b"),
          "big.jpg": imageBytes("jpg", 0, 4096),
          "ok.jpg": imageBytes("jpg"),
        }),
        new File([strToU8("not a zip")], "broken.zip"),
      ],
      { maxImageBytes: 1024 }
    );

    expect([...library.images.keys()]).toEqual(["ok.jpg"]);
    expect(messages(library)).toEqual([
      { severity: "warning", message: "2 files aren't JPG, PNG or WebP images and were skipped: a.txt, b.pdf." },
      { severity: "error", message: "That file isn't a ZIP archive, or it's empty." },
      { severity: "error", message: "photos.zip › big.jpg is larger than the 1 KB image limit." },
    ]);
    // The oversized image is remembered, so a product that lists it is told why.
    expect(library.rejected.get("big.jpg")).toBe("photos.zip › big.jpg is larger than the 1 KB image limit.");
    expect(library.stats.skipped).toBe(3);
  });

  it(`stops reading after ${MAX_LIBRARY_IMAGES} images`, async () => {
    const files = Array.from({ length: MAX_LIBRARY_IMAGES + 1 }, (_, index) => imageFile(`img-${index}.jpg`, index));
    const library = await buildImageLibrary(files);
    expect(library.images.size).toBe(MAX_LIBRARY_IMAGES);
    expect(messages(library)).toContainEqual({
      severity: "error",
      message: `More than ${MAX_LIBRARY_IMAGES} images were chosen; only the first ${MAX_LIBRARY_IMAGES} were read. Import in smaller batches.`,
    });
  });
});
