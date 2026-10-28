import type { ResolutionResult } from "./resolve";
import type { ImportPlan } from "./types";

// What publishing would do to the storefront. A published product is shown
// only while its status is "active" (every storefront query filters on it, and
// checkout refuses anything else); "draft" and "archived" products are
// published but stay hidden. So a publish run is described by how many go
// live, and by the warnings an editor must see before confirming.

export interface PublishWarning {
  handle: string;
  title: string;
  message: string;
}

export interface PublishSummary {
  /** Products that would be published: everything the check didn't block. */
  products: number;
  /** Published with status "active": visible on the storefront within about a minute. */
  live: number;
  /** Published with status "draft" or "archived": in Sanity, not on the storefront. */
  hidden: number;
  warnings: PublishWarning[];
}

export function summarizePublish(plan: ImportPlan, preview: ResolutionResult): PublishSummary {
  const planned = new Map(plan.products.map((product) => [product.documentId, product]));
  const summary: PublishSummary = { products: 0, live: 0, hidden: 0, warnings: [] };

  for (const entry of preview.products) {
    const product = planned.get(entry.documentId);
    if (!product || entry.outcome === "blocked") continue;
    summary.products += 1;
    const active = entry.status === "active";
    if (active) summary.live += 1;
    else summary.hidden += 1;

    const warn = (message: string) => summary.warnings.push({ handle: entry.handle, title: entry.title, message });
    if (active && entry.images.length === 0) {
      warn("Active with no images: it will be live on the storefront without a photo.");
    }
    const variants = product.fields.variants ?? [];
    if (product.fields.hasVariants && variants.length && variants.every((variant) => !variant.available)) {
      warn(
        active
          ? "Every variant is unavailable: it will be live on the storefront but can't be bought."
          : "Every variant is unavailable, so it can't be bought once it's made active."
      );
    }
  }
  return summary;
}
