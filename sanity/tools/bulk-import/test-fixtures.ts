// Test-only helpers: tiny byte sequences that pass the image signature checks.
// Not imported by the tool itself.

const SIGNATURES = {
  jpg: [0xff, 0xd8, 0xff, 0xe0],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
};

/** Bytes that look like an image of the given format; `seed` makes files differ. */
export function imageBytes(format: keyof typeof SIGNATURES, seed = 0, length = 64) {
  const bytes = new Uint8Array(length);
  bytes.set(SIGNATURES[format]);
  for (let index = SIGNATURES[format].length; index < length; index += 1) bytes[index] = (seed + index) % 256;
  return bytes;
}

export function imageFile(name: string, seed = 0, length = 64) {
  const extension = name.split(".").pop()!.toLowerCase();
  const format = extension === "png" ? "png" : extension === "webp" ? "webp" : "jpg";
  return new File([imageBytes(format, seed, length)], name);
}
