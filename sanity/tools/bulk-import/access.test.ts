import { describe, expect, it } from "vitest";
import { getImportAccess } from "@/sanity/tools/bulk-import/access";

describe("getImportAccess", () => {
  it("lets administrators, editors and developers publish", () => {
    expect(getImportAccess(["administrator"])).toBe("publish");
    expect(getImportAccess(["editor"])).toBe("publish");
    expect(getImportAccess(["developer"])).toBe("publish");
  });

  it("limits contributors to drafts", () => {
    expect(getImportAccess(["contributor"])).toBe("drafts");
  });

  it("uses the strongest role when a user holds several", () => {
    expect(getImportAccess(["viewer", "contributor"])).toBe("drafts");
    expect(getImportAccess(["contributor", "editor"])).toBe("publish");
  });

  it("blocks viewers", () => {
    expect(getImportAccess(["viewer"])).toBe("none");
  });

  it("leaves custom roles and missing roles to Sanity to decide", () => {
    expect(getImportAccess(["catalog-manager"])).toBe("unknown");
    expect(getImportAccess(["viewer", "catalog-manager"])).toBe("unknown");
    expect(getImportAccess([])).toBe("unknown");
  });
});
