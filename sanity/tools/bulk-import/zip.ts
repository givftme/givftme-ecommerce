import { Unzip, UnzipInflate, type UnzipFile } from "fflate";
import { IMAGE_EXTENSIONS } from "./fields";

// Streams a ZIP archive and returns the image files inside it. Limits count the
// bytes that actually decompress, never the sizes the archive claims, so a
// crafted archive can't use a small header to hide a huge file.

const MB = 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes >= MB) return `${Math.round((bytes / MB) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export interface ZipLimits {
  /** Largest archive accepted. */
  archiveBytes: number;
  /** Most entries (files and folders) read before giving up. */
  entries: number;
  /** Largest single extracted image. */
  entryBytes: number;
  /** Most bytes extracted from one archive. */
  totalBytes: number;
}

export const ZIP_LIMITS: ZipLimits = {
  archiveBytes: 300 * MB,
  entries: 2000,
  entryBytes: 10 * MB,
  totalBytes: 500 * MB,
};

export type ZipSkipReason = "not-image" | "nested-zip" | "too-large" | "unreadable";

export interface ZipContents {
  /** Image entries, with their path inside the archive. */
  entries: { path: string; bytes: Uint8Array }[];
  skipped: { path: string; reason: ZipSkipReason }[];
  /** Set when the archive as a whole couldn't be read or broke a limit. */
  error: string | null;
}

/** Folders, macOS resource forks and OS thumbnail files: never product images. */
function isSystemEntry(path: string) {
  const name = path.split("/").pop() ?? "";
  return (
    path.endsWith("/") ||
    path.startsWith("__MACOSX/") ||
    name.startsWith(".") ||
    name.toLowerCase() === "thumbs.db" ||
    name.toLowerCase() === "desktop.ini"
  );
}

function skipReason(path: string): ZipSkipReason | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "zip") return "nested-zip";
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extension) ? null : "not-image";
}

function concat(chunks: Uint8Array[], length: number) {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function readZip(archive: Blob, limits: ZipLimits = ZIP_LIMITS): Promise<ZipContents> {
  const contents: ZipContents = { entries: [], skipped: [], error: null };
  const fail = (message: string) => {
    contents.error ??= message;
  };

  if (archive.size > limits.archiveBytes) {
    fail(`The ZIP file is over ${formatBytes(limits.archiveBytes)}. Split it into smaller archives.`);
    return contents;
  }

  let entryCount = 0;
  let extracted = 0;
  let damaged = false;
  // Entries still waiting for their last chunk; a truncated archive leaves some behind.
  const unfinished = new Map<string, () => void>();

  const unzip = new Unzip((file: UnzipFile) => {
    if (contents.error) return;
    entryCount += 1;
    if (entryCount > limits.entries) {
      fail(`The ZIP file has more than ${limits.entries} files. Split it into smaller archives.`);
      return;
    }

    // Normalise Windows-style separators some archivers write.
    const path = file.name.replace(/\\/g, "/");
    if (isSystemEntry(path)) return;
    const reason = skipReason(path);
    if (reason) {
      contents.skipped.push({ path, reason });
      return;
    }

    const chunks: Uint8Array[] = [];
    let size = 0;
    let done = false;
    const entryKey = `${entryCount}:${path}`;
    // An unknown compression method reports an error and then throws from
    // start(), so this can be reached twice for one entry.
    const skip = (why: ZipSkipReason) => {
      if (done) return;
      done = true;
      chunks.length = 0;
      unfinished.delete(entryKey);
      contents.skipped.push({ path, reason: why });
    };
    unfinished.set(entryKey, () => skip("unreadable"));

    file.ondata = (error, chunk, final) => {
      if (done || contents.error) return;
      if (error) {
        skip("unreadable");
        return;
      }
      size += chunk.length;
      extracted += chunk.length;
      if (extracted > limits.totalBytes) {
        done = true;
        fail(`The ZIP file extracts to more than ${formatBytes(limits.totalBytes)}. Split it into smaller archives.`);
        return;
      }
      if (size > limits.entryBytes) {
        skip("too-large");
        return;
      }
      chunks.push(chunk);
      if (final) {
        done = true;
        unfinished.delete(entryKey);
        contents.entries.push({ path, bytes: concat(chunks, size) });
      }
    };

    try {
      file.start();
    } catch {
      skip("unreadable");
    }
  });
  unzip.register(UnzipInflate);

  const reader = archive.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (contents.error) break;
      unzip.push(value ?? new Uint8Array(0), done);
      if (done) break;
    }
  } catch {
    damaged = !contents.error;
    fail("The ZIP file is damaged or uses a format that can't be read. Re-create it and try again.");
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  // Name the images a damaged archive cut off. When a limit stopped reading,
  // the error already explains why the rest is missing.
  if (!contents.error || damaged) {
    for (const markUnreadable of [...unfinished.values()]) markUnreadable();
  }
  if (!contents.error && entryCount === 0) fail("That file isn't a ZIP archive, or it's empty.");
  return contents;
}
