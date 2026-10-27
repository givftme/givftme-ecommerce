import { IMAGE_EXTENSIONS } from "./fields";
import type { IssueSeverity } from "./types";
import { formatBytes, readZip, ZIP_LIMITS, type ZipLimits, type ZipSkipReason } from "./zip";

// Reads the images an editor picked — loose files and ZIP archives — into a
// library keyed by filename. Nothing leaves the browser: files are only read
// and checked here.

const MB = 1024 * 1024;

export const MAX_IMAGE_BYTES = 10 * MB;
/** Enough for 500 products with 8 images each, plus variant images. */
export const MAX_LIBRARY_IMAGES = 5000;

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface LocalImage {
  /** Lowercased filename, the matching key. */
  key: string;
  filename: string;
  /** Where the file came from, for messages: "bag.jpg" or "photos.zip › bags/bag.jpg". */
  source: string;
  size: number;
  /** Detected from the file's contents, not its extension. */
  type: ImageMimeType;
  blob: Blob;
}

export interface ImageIntakeIssue {
  severity: IssueSeverity;
  source: string;
  message: string;
}

export interface ImageLibrary {
  /** Usable images by lowercased filename. */
  images: Map<string, LocalImage>;
  /** Filenames that belong to more than one different file; never matched. */
  conflicts: Map<string, string[]>;
  /** Filenames whose only file can't be used, with the reason. */
  rejected: Map<string, string>;
  issues: ImageIntakeIssue[];
  stats: { files: number; archives: number; images: number; skipped: number };
}

/** Sniffs the first bytes, so a renamed HEIC or PDF isn't taken for a JPG. */
export function detectImageType(bytes: Uint8Array): ImageMimeType | null {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function fileExtension(name: string) {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

export function isZipFile(file: File) {
  return fileExtension(file.name) === "zip";
}

function isImageName(name: string) {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/** Loose files the OS adds to folders; picked up by folder selection, never images. */
function isSystemFile(name: string) {
  const lower = name.toLowerCase();
  return lower.startsWith(".") || lower === "thumbs.db" || lower === "desktop.ini";
}


interface Candidate {
  key: string;
  filename: string;
  source: string;
  blob: Blob;
  /** Set when the file can't be used. */
  problem: string | null;
  type: ImageMimeType | null;
}

async function inspect(filename: string, source: string, blob: Blob, maxBytes: number): Promise<Candidate> {
  const candidate: Candidate = { key: filename.toLowerCase(), filename, source, blob, problem: null, type: null };

  if (blob.size === 0) {
    candidate.problem = `${source} is empty.`;
  } else if (blob.size > maxBytes) {
    candidate.problem = `${source} is ${formatBytes(blob.size)}; images can be up to ${formatBytes(maxBytes)}.`;
  } else {
    candidate.type = detectImageType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
    if (!candidate.type) {
      candidate.problem = `${source} isn't a real JPG, PNG or WebP image. It may be another format renamed, or damaged.`;
    }
  }
  return candidate;
}

async function sameBytes(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  return x.every((byte, index) => byte === y[index]);
}

/** Summary line for ZIP entries that aren't images at all. */
function skippedSummary(reason: "not-image" | "nested-zip", paths: string[]) {
  const one = paths.length === 1;
  const what =
    reason === "not-image"
      ? one
        ? "isn't a JPG, PNG or WebP image"
        : "aren't JPG, PNG or WebP images"
      : one
        ? "is a ZIP inside the ZIP, which isn't opened"
        : "are ZIP files inside the ZIP, which aren't opened";
  return `${paths.length} file${one ? "" : "s"} ${what} and ${one ? "was" : "were"} skipped: ${listNames(paths)}.`;
}

function zipProblem(reason: Exclude<ZipSkipReason, "not-image" | "nested-zip">, source: string, maxBytes: number) {
  return reason === "too-large"
    ? `${source} is larger than the ${formatBytes(maxBytes)} image limit.`
    : `${source} couldn't be read from the ZIP. It may be damaged, password-protected or use unsupported compression.`;
}

function listNames(names: string[]) {
  const shown = names.slice(0, 5).join(", ");
  return names.length > 5 ? `${shown} and ${names.length - 5} more` : shown;
}

export async function buildImageLibrary(
  files: readonly File[],
  { maxImageBytes = MAX_IMAGE_BYTES, zipLimits = ZIP_LIMITS }: { maxImageBytes?: number; zipLimits?: ZipLimits } = {}
): Promise<ImageLibrary> {
  const library: ImageLibrary = {
    images: new Map(),
    conflicts: new Map(),
    rejected: new Map(),
    issues: [],
    stats: { files: 0, archives: 0, images: 0, skipped: 0 },
  };
  const candidates: Candidate[] = [];
  let capped = false;
  const room = () => {
    if (candidates.length < MAX_LIBRARY_IMAGES) return true;
    capped = true;
    return false;
  };

  for (const file of files) {
    if (isSystemFile(file.name)) continue;
    library.stats.files += 1;

    if (isZipFile(file)) {
      library.stats.archives += 1;
      const zip = await readZip(file, { ...zipLimits, entryBytes: Math.min(zipLimits.entryBytes, maxImageBytes) });
      if (zip.error) library.issues.push({ severity: "error", source: file.name, message: zip.error });

      for (const entry of zip.entries) {
        if (!room()) break;
        const filename = entry.path.split("/").pop() ?? entry.path;
        const source = `${file.name} › ${entry.path}`;
        candidates.push(await inspect(filename, source, new Blob([entry.bytes as BlobPart]), maxImageBytes));
      }

      const notImages = new Map<"not-image" | "nested-zip", string[]>();
      for (const skipped of zip.skipped) {
        library.stats.skipped += 1;
        if (skipped.reason === "not-image" || skipped.reason === "nested-zip") {
          notImages.set(skipped.reason, [...(notImages.get(skipped.reason) ?? []), skipped.path]);
          continue;
        }
        // An image that was too big or unreadable is one the editor meant to
        // use: record it, so a product that needs it says why it's missing.
        const filename = skipped.path.split("/").pop() ?? skipped.path;
        const source = `${file.name} › ${skipped.path}`;
        candidates.push({
          key: filename.toLowerCase(),
          filename,
          source,
          blob: new Blob([]),
          type: null,
          problem: zipProblem(skipped.reason, source, maxImageBytes),
        });
      }
      for (const [reason, paths] of notImages) {
        library.issues.push({ severity: "warning", source: file.name, message: skippedSummary(reason, paths) });
      }
    } else if (isImageName(file.name)) {
      if (!room()) continue;
      candidates.push(await inspect(file.name, file.name, file, maxImageBytes));
    } else {
      library.stats.skipped += 1;
      library.issues.push({
        severity: "warning",
        source: file.name,
        message: `${file.name} isn't a JPG, PNG, WebP or ZIP file and was skipped.`,
      });
    }
  }

  if (capped) {
    library.issues.push({
      severity: "error",
      source: "Images",
      message: `More than ${MAX_LIBRARY_IMAGES} images were chosen; only the first ${MAX_LIBRARY_IMAGES} were read. Import in smaller batches.`,
    });
  }

  // Group by filename. One usable file → matched. Two different files with the
  // same name → a conflict: guessing which one a product meant could attach
  // the wrong photo, so neither is used until one is renamed.
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    groups.set(candidate.key, [...(groups.get(candidate.key) ?? []), candidate]);
  }

  for (const [key, group] of groups) {
    for (const candidate of group) {
      if (candidate.problem) library.issues.push({ severity: "error", source: candidate.source, message: candidate.problem });
    }

    const [first, ...rest] = group;
    let identical = true;
    for (const other of rest) {
      if (first.problem || other.problem || !(await sameBytes(first.blob, other.blob))) {
        identical = false;
        break;
      }
    }

    if (group.length > 1 && !identical) {
      const sources = group.map((candidate) => candidate.source);
      library.conflicts.set(key, sources);
      library.issues.push({
        severity: "error",
        source: first.filename,
        message: `${group.length} different files are named ${first.filename}: ${sources.join(", ")}. Rename them so each name is used once.`,
      });
    } else if (first.problem) {
      library.rejected.set(key, first.problem);
    } else {
      if (group.length > 1) {
        library.issues.push({
          severity: "warning",
          source: first.filename,
          message: `${first.filename} was chosen ${group.length} times; the copies are identical, so one is used.`,
        });
      }
      library.images.set(key, {
        key,
        filename: first.filename,
        source: first.source,
        size: first.blob.size,
        type: first.type!,
        blob: first.type && first.blob.type !== first.type ? first.blob.slice(0, first.blob.size, first.type) : first.blob,
      });
    }
  }

  library.stats.images = library.images.size;
  return library;
}
