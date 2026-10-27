import type { PortableTextBlock } from "./types";

// Pure parsers for single spreadsheet cells. Each returns either a value or a
// message written for the person fixing the spreadsheet.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

/** "Short Description " → "short_description", "Option 1 Name" → "option1_name", so headers survive hand edits. */
export function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^option_(\d)_/, "option$1_");
}

/** Lowercase ASCII slug: accents dropped, everything else collapsed to the separator. */
export function slugify(input: string, separator: "-" | "_" = "-") {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}

export const SLUG_MAX_LENGTH = 96;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Truncates a generated slug at a word boundary so it fits the schema's limit. */
export function fitSlug(slug: string) {
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  return slug.slice(0, SLUG_MAX_LENGTH).replace(/-[^-]*$/, "") || slug.slice(0, SLUG_MAX_LENGTH);
}

/** Splits a comma- or semicolon-separated cell (line breaks also count) into trimmed, non-empty items. */
export function splitList(raw: string) {
  return raw
    .split(/[,;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Whole naira only. formatPrice() rounds for display, so a fractional price
 * would show one amount and charge another. Accepts ₦, NGN or N prefixes and
 * thousands separators.
 */
export function parseNaira(raw: string, { allowZero = false } = {}): Parsed<number> {
  const cleaned = raw
    .trim()
    .replace(/^(₦|ngn|n)\s*/i, "")
    .replace(/[,\s]/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return fail(`"${raw}" isn't a number. Use whole naira, e.g. 45000.`);
  }

  const value = Number(cleaned);
  if (!Number.isInteger(value)) return fail("Use a whole naira amount, without kobo.");
  if (!Number.isSafeInteger(value)) return fail("That amount is too large.");
  if (value < 0) return fail("The amount can't be negative.");
  if (value === 0 && !allowZero) return fail("The amount must be more than ₦0.");
  return ok(value);
}

const TRUE_WORDS = new Set(["yes", "y", "true", "1", "available", "in stock"]);
const FALSE_WORDS = new Set(["no", "n", "false", "0", "unavailable", "sold out", "out of stock"]);

/** Blank cells take the fallback (the schema's initial value). */
export function parseBoolean(raw: string, fallback: boolean): Parsed<boolean> {
  const value = raw.trim().toLowerCase();
  if (!value) return ok(fallback);
  if (TRUE_WORDS.has(value)) return ok(true);
  if (FALSE_WORDS.has(value)) return ok(false);
  return fail(`"${raw}" isn't yes or no.`);
}

// Nigeria is on WAT (UTC+1) all year, with no daylight saving.
const LAGOS_OFFSET_MINUTES = 60;

const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const ZONED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Returns an ISO UTC timestamp, the format the Studio's datetime fields store.
 * Times without a zone are Lagos time. A date on its own is the start of that
 * day, or the end of it when `endOfDay` is set (so a sale ending "2026-11-30"
 * runs through the 30th).
 */
export function parseLagosDateTime(raw: string, { endOfDay = false } = {}): Parsed<string> {
  const value = raw.trim();

  if (ZONED_DATETIME.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fail(`"${raw}" isn't a valid date.`) : ok(date.toISOString());
  }

  const match = NAIVE_DATETIME.exec(value);
  if (!match) return fail(`"${raw}" isn't a date. Use YYYY-MM-DD HH:mm, e.g. 2026-11-01 09:00.`);

  const [, year, month, day, hour, minute, second] = match;
  const dateOnly = hour === undefined;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: dateOnly ? (endOfDay ? 23 : 0) : Number(hour),
    minute: dateOnly ? (endOfDay ? 59 : 0) : Number(minute),
    second: dateOnly ? (endOfDay ? 59 : 0) : Number(second ?? 0),
  };

  const wallClock = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  // Date.UTC rolls 2026-02-30 over to March; reject instead of guessing.
  if (
    wallClock.getUTCFullYear() !== parts.year ||
    wallClock.getUTCMonth() !== parts.month - 1 ||
    wallClock.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    return fail(`"${raw}" isn't a real date or time.`);
  }

  return ok(new Date(wallClock.getTime() - LAGOS_OFFSET_MINUTES * 60_000).toISOString());
}

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

/** Drops any folder from a filename typed into the sheet ("photos/bag.jpg" → "bag.jpg"). */
export function imageBasename(raw: string) {
  return raw.trim().split(/[\\/]/).pop() ?? "";
}

export function parseImageFilename(raw: string): Parsed<string> {
  const filename = imageBasename(raw);
  const extension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";

  if (!filename) return fail("The image filename is empty.");
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    return fail(`"${filename}" isn't a JPG, PNG or WebP file.`);
  }
  return ok(filename);
}

/** One paragraph block per non-empty line, which is how plain text reads in the Studio editor. */
export function toPortableText(text: string): PortableTextBlock[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      _type: "block",
      _key: `block-${index}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `span-${index}`, text: line, marks: [] }],
    }));
}
