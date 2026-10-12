import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    // .agents/ holds Claude Code skill scripts with their own node:test files —
    // not part of this app's test suite, and running them under vitest breaks it.
    exclude: ["**/node_modules/**", ".agents/**"],
  },
});
