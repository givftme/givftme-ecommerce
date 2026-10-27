import { UploadIcon } from "@sanity/icons";
import type { Tool } from "sanity";
import { BulkImportTool } from "./BulkImportTool";

// Served at /studio/bulk-import by the existing catch-all Studio route.
export const bulkImportTool: Tool = {
  name: "bulk-import",
  title: "Bulk import",
  icon: UploadIcon,
  component: BulkImportTool,
};
