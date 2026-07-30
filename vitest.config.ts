import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // .agents/ holds Claude Code skill scripts with their own node:test files —
    // not part of this app's test suite, and running them under vitest breaks it.
    exclude: ["**/node_modules/**", ".agents/**"],
  },
});
