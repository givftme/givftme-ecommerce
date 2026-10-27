import { describe, expect, it, vi } from "vitest";
import type { LocalImage } from "@/sanity/tools/bulk-import/images";
import { uploadImages } from "@/sanity/tools/bulk-import/uploads";

const image = (name: string): LocalImage => ({
  key: name,
  filename: name,
  source: name,
  size: 10,
  type: "image/jpeg",
  blob: new Blob([name]),
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

/** A client whose uploads finish when the test says so, tracking how many run at once. */
function slowClient(
  fail: (filename: string) => unknown = () => undefined,
  assetId = (filename: string) => `image-${filename.replace(/\W/g, "")}-1x1-jpg`
) {
  let running = 0;
  const pending: { filename: string; finish: () => void }[] = [];
  const stats = { maxRunning: 0, started: [] as string[] };
  const upload = vi.fn(async (_type: string, _blob: Blob, { filename }: { filename: string }) => {
    running += 1;
    stats.maxRunning = Math.max(stats.maxRunning, running);
    stats.started.push(filename);
    const gate = deferred();
    pending.push({ filename, finish: gate.resolve });
    await gate.promise;
    running -= 1;
    const error = fail(filename);
    if (error) throw error;
    return { _id: assetId(filename) };
  });
  const finishAll = async () => {
    while (pending.length) {
      pending.shift()!.finish();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  return { client: { assets: { upload } } as never, upload, stats, finishAll };
}

const images = Array.from({ length: 7 }, (_, index) => image(`p${index}.jpg`));

describe("uploadImages", () => {
  it("uploads each image once, never more than three at a time", async () => {
    const { client, upload, stats, finishAll } = slowClient();
    const result = uploadImages(client, images);
    await finishAll();
    const { outcomes, halt } = await result;

    expect(halt).toBeNull();
    expect(stats.maxRunning).toBe(3);
    expect(upload).toHaveBeenCalledTimes(7);
    expect(new Set(stats.started).size).toBe(7);
    expect(outcomes.get(images[0])).toEqual({ status: "uploaded", assetId: "image-p0jpg-1x1-jpg" });
    expect(upload).toHaveBeenCalledWith("image", images[0].blob, { filename: "p0.jpg", contentType: "image/jpeg" });
  });

  it("records a failed upload and carries on with the rest", async () => {
    const { client, finishAll } = slowClient((name) =>
      name === "p2.jpg" ? Object.assign(new Error("Too large"), { statusCode: 413 }) : undefined
    );
    const result = uploadImages(client, images);
    await finishAll();
    const { outcomes, halt } = await result;

    expect(halt).toBeNull();
    expect(outcomes.get(images[2])).toEqual({ status: "failed", message: "Sanity answered 413: Too large" });
    expect([...outcomes.values()].filter((outcome) => outcome.status === "uploaded")).toHaveLength(6);
  });

  it("starts no more uploads after a permission error", async () => {
    const { client, stats, finishAll } = slowClient((name) =>
      name === "p0.jpg" ? Object.assign(new Error("Forbidden"), { statusCode: 403 }) : undefined
    );
    const result = uploadImages(client, images);
    await finishAll();
    const { outcomes, halt } = await result;

    expect(halt).toEqual({ reason: "permission", message: "Sanity refused the request (403): Forbidden" });
    // The three already in flight finish; nothing new starts.
    expect(stats.started).toEqual(["p0.jpg", "p1.jpg", "p2.jpg"]);
    expect(outcomes.has(images[3])).toBe(false);
  });

  it("stops starting uploads when asked, letting in-flight ones finish", async () => {
    const { client, stats, finishAll } = slowClient();
    let stop = false;
    const result = uploadImages(client, images, { shouldStop: () => stop });
    stop = true;
    await finishAll();
    const { outcomes, halt } = await result;

    expect(halt).toEqual({ reason: "cancelled" });
    expect(stats.started).toEqual(["p0.jpg", "p1.jpg", "p2.jpg"]);
    expect(outcomes.size).toBe(3);
  });

  it("fails an upload whose answer isn't an image asset", async () => {
    const { client, finishAll } = slowClient(undefined, (filename) => (filename === "p1.jpg" ? "file-p1-pdf" : `image-${filename.replace(/\W/g, "")}-1x1-jpg`));
    const result = uploadImages(client, images.slice(0, 2));
    await finishAll();
    const { outcomes } = await result;

    expect(outcomes.get(images[1])).toEqual({ status: "failed", message: "Sanity answered with something that isn't an image asset." });
    expect(outcomes.get(images[0])?.status).toBe("uploaded");
  });

  it("stops when the check before an upload fails", async () => {
    const { client, upload } = slowClient();
    const { halt, outcomes } = await uploadImages(client, images, {
      beforeEach: () => {
        throw new Error("The dataset changed.");
      },
    });

    expect(halt).toEqual({ reason: "target", message: "The dataset changed." });
    expect(upload).not.toHaveBeenCalled();
    expect(outcomes.size).toBe(0);
  });
});
