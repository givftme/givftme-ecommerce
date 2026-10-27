import { describe, expect, it } from "vitest";
import {
  fitSlug,
  imageBasename,
  normalizeHeader,
  parseBoolean,
  parseImageFilename,
  parseLagosDateTime,
  parseNaira,
  slugify,
  splitList,
  toPortableText,
} from "@/sanity/tools/bulk-import/fields";

describe("normalizeHeader", () => {
  it("maps hand-edited headers to column names", () => {
    expect(normalizeHeader(" Short Description ")).toBe("short_description");
    expect(normalizeHeader("SKU")).toBe("sku");
    expect(normalizeHeader("compare-at price")).toBe("compare_at_price");
    expect(normalizeHeader("Option 1 Name")).toBe("option1_name");
    expect(normalizeHeader("option2_value")).toBe("option2_value");
  });
});

describe("slugify", () => {
  it("lowercases, drops accents and collapses separators", () => {
    expect(slugify("Café Délice — Gift Box!")).toBe("cafe-delice-gift-box");
    expect(slugify("  --Leather  Bag--  ")).toBe("leather-bag");
    expect(slugify("Gift Wrap", "_")).toBe("gift_wrap");
    expect(slugify("🎁")).toBe("");
  });

  it("fits long slugs at a word boundary", () => {
    const slug = fitSlug(slugify("word ".repeat(40)));
    expect(slug.length).toBeLessThanOrEqual(96);
    expect(slug.endsWith("word")).toBe(true);
  });
});

describe("splitList", () => {
  it("splits on commas, semicolons and line breaks", () => {
    expect(splitList(" a.jpg, b.jpg;c.jpg\nd.jpg ,, ")).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
    expect(splitList("")).toEqual([]);
  });
});

describe("parseNaira", () => {
  it("accepts whole naira with common prefixes and separators", () => {
    expect(parseNaira("45000")).toEqual({ ok: true, value: 45000 });
    expect(parseNaira("₦45,000")).toEqual({ ok: true, value: 45000 });
    expect(parseNaira("NGN 45 000")).toEqual({ ok: true, value: 45000 });
    expect(parseNaira("N45000")).toEqual({ ok: true, value: 45000 });
    expect(parseNaira("45000.00")).toEqual({ ok: true, value: 45000 });
  });

  it("rejects kobo, negatives, zero and text", () => {
    expect(parseNaira("45000.50").ok).toBe(false);
    expect(parseNaira("-100").ok).toBe(false);
    expect(parseNaira("0").ok).toBe(false);
    expect(parseNaira("0", { allowZero: true })).toEqual({ ok: true, value: 0 });
    expect(parseNaira("forty").ok).toBe(false);
    expect(parseNaira("1e5").ok).toBe(false);
  });
});

describe("parseBoolean", () => {
  it("reads yes/no words and falls back on blanks", () => {
    expect(parseBoolean("", true)).toEqual({ ok: true, value: true });
    expect(parseBoolean("", false)).toEqual({ ok: true, value: false });
    expect(parseBoolean("Yes", false)).toEqual({ ok: true, value: true });
    expect(parseBoolean("TRUE", false)).toEqual({ ok: true, value: true });
    expect(parseBoolean("Sold out", true)).toEqual({ ok: true, value: false });
    expect(parseBoolean("0", true)).toEqual({ ok: true, value: false });
    expect(parseBoolean("maybe", true).ok).toBe(false);
  });
});

describe("parseLagosDateTime", () => {
  it("reads zoneless times as Lagos time (UTC+1)", () => {
    expect(parseLagosDateTime("2026-11-01 09:00")).toEqual({ ok: true, value: "2026-11-01T08:00:00.000Z" });
    expect(parseLagosDateTime("2026-11-01T09:30:15")).toEqual({ ok: true, value: "2026-11-01T08:30:15.000Z" });
  });

  it("treats a bare date as the start of the day, or the end with endOfDay", () => {
    expect(parseLagosDateTime("2026-11-01")).toEqual({ ok: true, value: "2026-10-31T23:00:00.000Z" });
    expect(parseLagosDateTime("2026-11-30", { endOfDay: true })).toEqual({
      ok: true,
      value: "2026-11-30T22:59:59.000Z",
    });
  });

  it("keeps explicit zones", () => {
    expect(parseLagosDateTime("2026-11-01T09:00:00Z")).toEqual({ ok: true, value: "2026-11-01T09:00:00.000Z" });
    expect(parseLagosDateTime("2026-11-01T09:00:00+01:00")).toEqual({
      ok: true,
      value: "2026-11-01T08:00:00.000Z",
    });
  });

  it("rejects ambiguous and impossible dates", () => {
    expect(parseLagosDateTime("01/11/2026").ok).toBe(false);
    expect(parseLagosDateTime("2026-02-30").ok).toBe(false);
    expect(parseLagosDateTime("2026-11-01 24:00").ok).toBe(false);
    expect(parseLagosDateTime("next friday").ok).toBe(false);
  });
});

describe("image filenames", () => {
  it("drops folders and checks the extension", () => {
    expect(imageBasename("photos\\bags/front.JPG")).toBe("front.JPG");
    expect(parseImageFilename("photos/front.JPG")).toEqual({ ok: true, value: "front.JPG" });
    expect(parseImageFilename("front.webp")).toEqual({ ok: true, value: "front.webp" });
    expect(parseImageFilename("front.jpeg").ok).toBe(true);
    expect(parseImageFilename("front.gif").ok).toBe(false);
    expect(parseImageFilename("front").ok).toBe(false);
    expect(parseImageFilename("photos/").ok).toBe(false);
  });
});

describe("toPortableText", () => {
  it("makes one paragraph block per non-empty line", () => {
    expect(toPortableText("First line\r\n\n  Second line  ")).toEqual([
      {
        _type: "block",
        _key: "block-0",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "span-0", text: "First line", marks: [] }],
      },
      {
        _type: "block",
        _key: "block-1",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "span-1", text: "Second line", marks: [] }],
      },
    ]);
    expect(toPortableText("   ")).toEqual([]);
  });
});
