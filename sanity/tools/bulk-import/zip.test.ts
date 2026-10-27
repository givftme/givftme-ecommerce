import { strToU8, Zip, ZipDeflate, ZipPassThrough, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { imageBytes } from "@/sanity/tools/bulk-import/test-fixtures";
import { readZip, ZIP_LIMITS, type ZipLimits } from "@/sanity/tools/bulk-import/zip";

const zipBlob = (files: Zippable) => new Blob([zipSync(files) as BlobPart]);
const limits = (overrides: Partial<ZipLimits>): ZipLimits => ({ ...ZIP_LIMITS, ...overrides });

describe("readZip", () => {
  it("extracts deflated and stored images from nested folders", async () => {
    const front = imageBytes("jpg", 1);
    const side = imageBytes("png", 2);
    const contents = await readZip(
      zipBlob({ "front.jpg": front, products: { bags: { "side.PNG": [side, { level: 0 }] } } })
    );

    expect(contents.error).toBeNull();
    expect(contents.skipped).toEqual([]);
    expect(contents.entries).toEqual([
      { path: "front.jpg", bytes: front },
      { path: "products/bags/side.PNG", bytes: side },
    ]);
  });

  it("ignores folders and OS files, and skips non-images and nested ZIPs", async () => {
    const contents = await readZip(
      zipBlob({
        "__MACOSX/._front.jpg": strToU8("resource fork"),
        ".DS_Store": strToU8("finder"),
        "Thumbs.db": strToU8("thumbs"),
        "front.jpg": imageBytes("jpg"),
        "notes.txt": strToU8("hello"),
        "more.zip": zipSync({ "inner.jpg": imageBytes("jpg") }),
      })
    );

    expect(contents.entries.map((entry) => entry.path)).toEqual(["front.jpg"]);
    expect(contents.skipped).toEqual([
      { path: "notes.txt", reason: "not-image" },
      { path: "more.zip", reason: "nested-zip" },
    ]);
  });

  it("reads archives written by streaming tools (sizes in data descriptors)", async () => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (error) throw error;
      chunks.push(chunk);
    });
    const deflated = new ZipDeflate("a.webp", { level: 6 });
    const stored = new ZipPassThrough("b.jpg");
    zip.add(deflated);
    deflated.push(imageBytes("webp", 3, 5000), true);
    zip.add(stored);
    stored.push(imageBytes("jpg", 4), true);
    zip.end();

    const contents = await readZip(new Blob(chunks as BlobPart[]));
    expect(contents.error).toBeNull();
    expect(contents.entries).toEqual([
      { path: "a.webp", bytes: imageBytes("webp", 3, 5000) },
      { path: "b.jpg", bytes: imageBytes("jpg", 4) },
    ]);
  });

  it("skips entries larger than the per-image limit", async () => {
    const contents = await readZip(
      zipBlob({ "big.jpg": imageBytes("jpg", 0, 5000), "small.jpg": imageBytes("jpg") }),
      limits({ entryBytes: 1000 })
    );
    expect(contents.entries.map((entry) => entry.path)).toEqual(["small.jpg"]);
    expect(contents.skipped).toEqual([{ path: "big.jpg", reason: "too-large" }]);
  });

  it("counts real decompressed bytes, not the size the header claims", async () => {
    // 200 KB of zeros compresses to a few hundred bytes; then lie that it's 10 bytes.
    const bomb = new Uint8Array(200_000);
    bomb.set(imageBytes("jpg", 0, 4));
    const archive = zipSync({ "bomb.jpg": bomb });
    new DataView(archive.buffer, archive.byteOffset).setUint32(22, 10, true);

    const contents = await readZip(new Blob([archive as BlobPart]), limits({ entryBytes: 1000 }));
    expect(contents.entries).toEqual([]);
    expect(contents.skipped).toEqual([{ path: "bomb.jpg", reason: "too-large" }]);
  });

  it("stops when an archive extracts past the total limit", async () => {
    const files: Zippable = {};
    for (let index = 0; index < 5; index += 1) files[`img-${index}.jpg`] = imageBytes("jpg", index, 3000);

    const contents = await readZip(zipBlob(files), limits({ totalBytes: 10_000 }));
    expect(contents.error).toBe("The ZIP file extracts to more than 10 KB. Split it into smaller archives.");
    expect(contents.entries.length).toBeLessThan(5);
  });

  it("rejects archives with too many entries or too many bytes", async () => {
    const files: Zippable = {};
    for (let index = 0; index < 4; index += 1) files[`img-${index}.jpg`] = imageBytes("jpg", index);

    expect((await readZip(zipBlob(files), limits({ entries: 3 }))).error).toBe(
      "The ZIP file has more than 3 files. Split it into smaller archives."
    );
    expect((await readZip(zipBlob(files), limits({ archiveBytes: 10 }))).error).toBe(
      "The ZIP file is over 10 bytes. Split it into smaller archives."
    );
  });

  it("reports entries it can't decompress, such as encrypted ones", async () => {
    const archive = zipSync({ "locked.jpg": imageBytes("jpg", 0, 500), "open.jpg": imageBytes("jpg") });
    // Compression method 99 is what AES-encrypted entries use.
    new DataView(archive.buffer, archive.byteOffset).setUint16(8, 99, true);

    const contents = await readZip(new Blob([archive as BlobPart]));
    expect(contents.entries.map((entry) => entry.path)).toEqual(["open.jpg"]);
    expect(contents.skipped).toEqual([{ path: "locked.jpg", reason: "unreadable" }]);
  });

  it("keeps complete images and names the one cut off by a truncated archive", async () => {
    const whole = imageBytes("jpg", 1);
    const archive = zipSync({
      "first.jpg": [whole, { level: 0 }],
      "photo.jpg": [imageBytes("jpg", 0, 20_000), { level: 0 }],
    });
    const contents = await readZip(new Blob([archive.subarray(0, 5_000) as BlobPart]));
    expect(contents.error).toBe(
      "The ZIP file is damaged or uses a format that can't be read. Re-create it and try again."
    );
    expect(contents.entries).toEqual([{ path: "first.jpg", bytes: whole }]);
    expect(contents.skipped).toEqual([{ path: "photo.jpg", reason: "unreadable" }]);
  });

  it("rejects files that aren't ZIP archives", async () => {
    const contents = await readZip(new Blob([strToU8("definitely not a zip")]));
    expect(contents.error).toBe("That file isn't a ZIP archive, or it's empty.");
  });
});
