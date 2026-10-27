import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  cellToText,
  MAX_SPREADSHEET_BYTES,
  parseCsv,
  parseXlsx,
  readSpreadsheet,
  SpreadsheetError,
} from "@/sanity/tools/bulk-import/parse";

type XlsxCell = string | number | { date: number } | null;

// Builds a minimal real .xlsx workbook. `{ date }` cells are Excel serial
// numbers styled with a date format, the way Excel saves typed dates.
function buildXlsx(rows: XlsxCell[][]): ArrayBuffer {
  const columnName = (index: number) => String.fromCharCode(65 + index);
  const sheetRows = rows
    .map((cells, rowIndex) => {
      const ref = rowIndex + 1;
      const xmlCells = cells
        .map((cell, cellIndex) => {
          const at = `${columnName(cellIndex)}${ref}`;
          if (cell === null) return "";
          if (typeof cell === "number") return `<c r="${at}"><v>${cell}</v></c>`;
          if (typeof cell === "object") return `<c r="${at}" s="1"><v>${cell.date}</v></c>`;
          return `<c r="${at}" t="inlineStr"><is><t xml:space="preserve">${cell}</t></is></c>`;
        })
        .join("");
      return `<row r="${ref}">${xmlCells}</row>`;
    })
    .join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };

  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])));
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
}

describe("parseCsv", () => {
  it("parses quoted fields with delimiters, line breaks and escaped quotes", () => {
    const csv = 'handle,title,description\r\nbag,"Bag, leather","Line one\nSays ""hi"""\r\n';
    expect(parseCsv(csv)).toEqual([
      ["handle", "title", "description"],
      ["bag", "Bag, leather", 'Line one\nSays "hi"'],
    ]);
  });

  it("strips a BOM and trims cells", () => {
    expect(parseCsv("﻿handle , title\n bag ,  Bag ")).toEqual([
      ["handle", "title"],
      ["bag", "Bag"],
    ]);
  });

  it("keeps blank rows so row numbers match the spreadsheet", () => {
    const rows = parseCsv("handle\nfirst\n\nthird\n");
    expect(rows).toEqual([["handle"], ["first"], [""], ["third"]]);
  });

  it("detects semicolon and tab delimiters from the header", () => {
    expect(parseCsv("handle;title\nbag;Bag, big")).toEqual([
      ["handle", "title"],
      ["bag", "Bag, big"],
    ]);
    expect(parseCsv("handle\ttitle\nbag\tBag")).toEqual([
      ["handle", "title"],
      ["bag", "Bag"],
    ]);
  });

  it("ignores delimiters inside quoted headers when detecting", () => {
    expect(parseCsv('"a;b",c,d\n1,2,3')[0]).toEqual(["a;b", "c", "d"]);
  });

  it("returns no rows for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("cellToText", () => {
  it("stringifies spreadsheet values", () => {
    expect(cellToText(null)).toBe("");
    expect(cellToText(undefined)).toBe("");
    expect(cellToText("  bag ")).toBe("bag");
    expect(cellToText(45000)).toBe("45000");
    expect(cellToText(true)).toBe("true");
  });

  it("writes dates as the wall-clock time typed into the cell", () => {
    expect(cellToText(new Date(Date.UTC(2026, 10, 1, 9, 30)))).toBe("2026-11-01 09:30:00");
    expect(cellToText(new Date(Date.UTC(2026, 10, 30)))).toBe("2026-11-30");
  });
});

describe("parseXlsx", () => {
  it("reads the first sheet as text, keeping blank rows", async () => {
    const workbook = buildXlsx([
      ["handle", "price", "sale_start", "sku"],
      [" bag ", 45000, { date: 46327.375 }, "00123"],
      [],
      ["shoe", 30000, null, null],
    ]);

    expect(await parseXlsx(workbook)).toEqual([
      ["handle", "price", "sale_start", "sku"],
      ["bag", "45000", "2026-11-01 09:00:00", "00123"],
      ["", "", "", ""],
      ["shoe", "30000", "", ""],
    ]);
  });

  it("returns stored number text rather than a rounded float", async () => {
    const workbook = buildXlsx([["price"], [45000.5]]);
    expect(await parseXlsx(workbook)).toEqual([["price"], ["45000.5"]]);
  });

  it("rejects files that aren't workbooks", async () => {
    const notAWorkbook = new TextEncoder().encode("handle,title").buffer as ArrayBuffer;
    await expect(parseXlsx(notAWorkbook)).rejects.toBeInstanceOf(SpreadsheetError);
  });
});

describe("readSpreadsheet", () => {
  it("routes .csv and .xlsx files to the right parser", async () => {
    const csv = new File(["handle,title\nbag,Bag"], "products.CSV", { type: "text/csv" });
    expect(await readSpreadsheet(csv)).toEqual([
      ["handle", "title"],
      ["bag", "Bag"],
    ]);

    const xlsx = new File([buildXlsx([["handle"], ["bag"]])], "products.xlsx");
    expect(await readSpreadsheet(xlsx)).toEqual([["handle"], ["bag"]]);
  });

  it("explains unsupported and oversized files", async () => {
    await expect(readSpreadsheet(new File(["x"], "old.xls"))).rejects.toThrow(/\.xls workbooks/);
    await expect(readSpreadsheet(new File(["x"], "notes.txt"))).rejects.toThrow(/\.csv or \.xlsx/);
    const oversized = new File([new Uint8Array(MAX_SPREADSHEET_BYTES + 1)], "big.csv");
    await expect(readSpreadsheet(oversized)).rejects.toThrow(/over 5 MB/);
  });
});
