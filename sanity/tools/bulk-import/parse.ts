import { InvalidInputError, readSheet } from "read-excel-file/universal";

// Turns a spreadsheet file into rows of trimmed text cells. Blank rows are
// kept so row numbers in error messages match what the spreadsheet app shows.

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;

export class SpreadsheetError extends Error {}

/**
 * RFC 4180 CSV with the delimiter (comma, semicolon or tab) detected from the
 * header row, since Excel in some locales saves "CSV" with semicolons.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

function detectDelimiter(source: string) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;

  for (const char of source) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && char in counts) counts[char as keyof typeof counts] += 1;
  }

  const [best] = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1]);
  return best[1] > 0 ? best[0] : ",";
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Spreadsheet cell → text. Excel dates carry no timezone; read-excel-file
 * returns them as UTC, so the UTC fields are the wall-clock time the editor
 * typed, which parseLagosDateTime() then reads as Lagos time.
 */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
    return hasTime
      ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
      : date;
  }
  return String(value).trim();
}

/** Reads the first sheet of an .xlsx file. Numbers come back as the text Excel stored. */
export async function parseXlsx(data: ArrayBuffer): Promise<string[][]> {
  try {
    const rows = await readSheet(data, { parseNumber: (text: string) => text, trim: false });
    return rows.map((cells) => cells.map(cellToText));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new SpreadsheetError("That file doesn't look like an Excel workbook. Save it as .xlsx or .csv.");
    }
    throw new SpreadsheetError("Couldn't read that workbook. Save it again as .xlsx or .csv and retry.");
  }
}

export async function readSpreadsheet(file: File): Promise<string[][]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetError("That spreadsheet is over 5 MB. Split it into smaller files.");
  }
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") return parseXlsx(await file.arrayBuffer());
  if (extension === "xls") {
    throw new SpreadsheetError("Old .xls workbooks aren't supported. In Excel, save as .xlsx or .csv.");
  }
  throw new SpreadsheetError("Choose a .csv or .xlsx file.");
}
