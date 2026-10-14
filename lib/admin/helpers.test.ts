import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/admin/csv";
import { isSensitiveOccasion, maskToInitials, MIN_AGGREGATE_SIZE, suppressSmallGroup } from "@/lib/admin/privacy";
import { createZip, crc32 } from "@/lib/admin/zip";

describe("privacy helpers", () => {
  it("strips export rows for groups under the minimum size", () => {
    expect(suppressSmallGroup(Array.from({ length: MIN_AGGREGATE_SIZE - 1 }, (_, i) => i))).toEqual({ rows: [], suppressed: true });
    const enough = Array.from({ length: MIN_AGGREGATE_SIZE }, (_, i) => i);
    expect(suppressSmallGroup(enough)).toEqual({ rows: enough, suppressed: false });
  });

  it("masks names to initials", () => {
    expect(maskToInitials("Adaeze  okafor")).toBe("A.O.");
    expect(maskToInitials("Tolu")).toBe("T.");
    expect(maskToInitials("  ")).toBe("—");
    expect(maskToInitials(null)).toBe("—");
  });

  it("recognises sensitive occasions", () => {
    expect(isSensitiveOccasion("Remembrance")).toBe(true);
    expect(isSensitiveOccasion("sympathy")).toBe(true);
    expect(isSensitiveOccasion("birthday")).toBe(false);
  });
});

describe("csv", () => {
  it("quotes separators and neutralises formulas", () => {
    expect(csvCell('Say "hi", Ada')).toBe('"Say ""hi"", Ada"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+2348030000000")).toBe("'+2348030000000");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x\ny"]])).toBe('a,b\r\n1,"x\ny"\r\n');
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes entries a reader can recover", () => {
    const zip = createZip([{ name: "profile.json", content: '{"name":"Adá"}' }, { name: "orders.json", content: "[]" }]);
    const view = new DataView(zip.buffer);
    const endOffset = zip.length - 22;
    expect(view.getUint32(endOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(endOffset + 10, true)).toBe(2);

    const centralOffset = view.getUint32(endOffset + 16, true);
    const names: string[] = [];
    let cursor = centralOffset;
    for (let i = 0; i < 2; i += 1) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50);
      const nameLength = view.getUint16(cursor + 28, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const size = view.getUint32(cursor + 24, true);
      names.push(new TextDecoder().decode(zip.subarray(cursor + 46, cursor + 46 + nameLength)));
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true);
      const data = zip.subarray(dataStart, dataStart + size);
      expect(crc32(data)).toBe(view.getUint32(cursor + 16, true));
      if (i === 0) expect(new TextDecoder().decode(data)).toBe('{"name":"Adá"}');
      cursor += 46 + nameLength;
    }
    expect(names).toEqual(["profile.json", "orders.json"]);
  });
});
