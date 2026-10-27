import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { describeError, isAuthError, isRefused, statusOf } from "@/sanity/tools/bulk-import/errors";
import {
  assertWriteTarget,
  WRITABLE_DATASETS,
  writableDatasetProblem,
  WriteTargetError,
} from "@/sanity/tools/bulk-import/safety";

const client = (config: { projectId?: string; dataset?: string }) => ({ config: () => config });
const workspace = { projectId: "proj", dataset: "development" };

describe("writable datasets", () => {
  it("allows development only", () => {
    expect(WRITABLE_DATASETS).toEqual(["development"]);
    expect(writableDatasetProblem("development")).toBeNull();
  });

  it("refuses production, other and unknown datasets", () => {
    expect(writableDatasetProblem("production")).toBe(
      "Imports into production aren't switched on yet. Only the development dataset can be imported into."
    );
    expect(writableDatasetProblem("staging")).toContain('Imports into "staging" aren\'t switched on.');
    expect(writableDatasetProblem("")).toContain("didn't say which dataset");
  });
});

describe("assertWriteTarget", () => {
  it("returns the target when the client matches the workspace", () => {
    expect(assertWriteTarget(client({ projectId: "proj", dataset: "development" }), workspace)).toEqual(workspace);
  });

  it("refuses production even when the client and workspace agree", () => {
    const production = { projectId: "proj", dataset: "production" };
    expect(() => assertWriteTarget(client(production), production)).toThrow(WriteTargetError);
    expect(() => assertWriteTarget(client(production), production)).toThrow("Imports into production aren't switched on");
  });

  it("refuses a client pointing at another dataset or project", () => {
    expect(() => assertWriteTarget(client({ projectId: "proj", dataset: "production" }), workspace)).toThrow(
      'The Studio client uses dataset "production", but this workspace is "development".'
    );
    expect(() => assertWriteTarget(client({ projectId: "other", dataset: "development" }), workspace)).toThrow(
      'The Studio client uses project "other", but this workspace is "proj".'
    );
    expect(() => assertWriteTarget(client({ dataset: "development" }), workspace)).toThrow('project "unknown"');
    expect(() => assertWriteTarget(client({ projectId: "proj" }), workspace)).toThrow('dataset "unknown"');
  });
});

describe("error handling", () => {
  const error = (statusCode?: number, description?: string) =>
    Object.assign(new Error("Request failed"), { statusCode, details: description ? { description } : undefined });

  it("sorts errors by what they mean for the import", () => {
    expect([401, 403].map((status) => isAuthError(error(status)))).toEqual([true, true]);
    expect(isAuthError(error(409))).toBe(false);
    expect([400, 409, 429].map((status) => isRefused(error(status)))).toEqual([true, true, true]);
    expect([500, undefined].map((status) => isRefused(error(status)))).toEqual([false, false]);
    expect(statusOf(new Error("offline"))).toBeNull();
  });

  it("describes errors briefly, preferring Sanity's own description", () => {
    expect(describeError(error(409, "Document already exists"))).toBe("Sanity answered 409: Document already exists");
    expect(describeError(error(429))).toBe("Sanity is rate-limiting requests. Wait a minute, then retry.");
    expect(describeError(new Error("fetch failed\n    at stack"))).toBe("No answer from Sanity: fetch failed");
  });
});

describe("no privileged credentials", () => {
  it("never imports the server write client or reads a token", () => {
    const folder = path.join(process.cwd(), "sanity/tools/bulk-import");
    const sources = readdirSync(folder).filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));
    expect(sources.length).toBeGreaterThan(10);
    for (const file of sources) {
      const source = readFileSync(path.join(folder, file), "utf8");
      expect(source, file).not.toMatch(/lib\/sanity\/write|SANITY_WRITE_TOKEN|process\.env|token\s*:/);
    }
  });

  it("only calls the client's reads, draft creation and asset upload", () => {
    const folder = path.join(process.cwd(), "sanity/tools/bulk-import");
    const sources = readdirSync(folder).filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));
    const used = new Set<string>();
    for (const file of sources) {
      const source = readFileSync(path.join(folder, file), "utf8");
      for (const [, method] of source.matchAll(/\bclient\s*\.\s*(\w+)/g)) used.add(method);
      expect(source, file).not.toMatch(
        /\.(createOrReplace|createIfNotExists|patch|mutate|transaction|publish|unpublish|discardDraft)\s*\(/
      );
      expect(source, file).not.toMatch(/\b(client|assets)\s*\.\s*delete\b/);
    }
    expect([...used].sort()).toEqual(["assets", "config", "create", "getDocument", "withConfig"]);
  });
});
