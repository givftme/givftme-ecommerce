import { isHttpsUrl } from "@/lib/og/format";

// Satori cannot decode WebP or AVIF, and a failed image fetch aborts the whole
// render, so images are fetched up front and anything unusable is skipped.
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  // Chunked so large images don't overflow the argument limit.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}

/** Returns the image as a data URL, or null if it can't be used in an OG image. */
export async function loadImageAsDataUrl(
  url: string | null | undefined,
  timeoutMs = 3000,
): Promise<string | null> {
  if (!isHttpsUrl(url)) {
    return null;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();

    if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    return `data:${contentType};base64,${toBase64(buffer)}`;
  } catch {
    return null;
  }
}
