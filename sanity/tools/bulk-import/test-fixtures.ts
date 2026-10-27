// Test-only helpers: tiny byte sequences that pass the image signature checks,
// real PNGs, and the proposed first live test. Not imported by the tool itself.
import { zlibSync } from "fflate";
import type { ColumnName } from "./columns";

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

/** A real PNG of one solid colour; different colours give genuinely different files. */
export function solidPng([red, green, blue]: [number, number, number], size = 8) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length);
    body.set([...type].map((char) => char.charCodeAt(0)));
    body.set(data, 4);
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(body, 4);
    view.setUint32(8 + data.length, crc32(body));
    return out;
  };
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, size);
  headerView.setUint32(4, size);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = new Uint8Array(size * (1 + size * 3));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) rows.set([red, green, blue], y * (1 + size * 3) + 1 + x * 3);
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(rows)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

/**
 * The proposed first live import into development: three fictional draft
 * products, no collections or suppliers. The mug's image is shared with the
 * sock's gallery, so two files are uploaded.
 */
export const FIRST_LIVE_TEST_ROWS: Partial<Record<ColumnName, string>>[] = [
  {
    handle: "zz-test-mug",
    title: "TEST - Bulk Import Mug",
    status: "draft",
    short_description: "Fictional product for an import test. Safe to delete.",
    category: "Test",
    price: "1000",
    sku: "ZZTEST-MUG",
    images: "zz-test-mug.png",
    image_alt: "Test mug",
  },
  {
    handle: "zz-test-tote",
    title: "TEST - Bulk Import Tote",
    status: "draft",
    short_description: "Fictional product for an import test. Safe to delete.",
    category: "Test",
    price: "1500",
    sku: "ZZTEST-TOTE",
  },
  {
    handle: "zz-test-sock",
    title: "TEST - Bulk Import Sock",
    status: "draft",
    short_description: "Fictional product for an import test. Safe to delete.",
    category: "Test",
    price: "500",
    sku: "ZZTEST-SOCK-RED",
    option1_name: "Colour",
    option1_value: "Red",
    variant_available: "yes",
    variant_image: "zz-test-sock-red.png",
    images: "zz-test-mug.png",
  },
  {
    handle: "zz-test-sock",
    price: "500",
    sku: "ZZTEST-SOCK-BLUE",
    option1_value: "Blue",
    variant_available: "no",
  },
];

export const FIRST_LIVE_TEST_IMAGES = {
  "zz-test-mug.png": [200, 30, 30],
  "zz-test-sock-red.png": [30, 60, 200],
} as const satisfies Record<string, [number, number, number]>;
