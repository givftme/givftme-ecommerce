// Where the importer may write. Being logged in to the Studio is never enough:
// the dataset must be on this list, and the client doing the writing must
// point at the same project and dataset the editor is looking at. Checked
// before the import starts and again before every upload and every product.

/** Drafts may be created in development only. Production stays off until it's approved. */
export const WRITABLE_DATASETS: readonly string[] = ["development"];

/** Products may be published in development only. A separate list, so publishing can never widen by accident. */
export const PUBLISHABLE_DATASETS: readonly string[] = ["development"];

/** Drafts are the default; publishing has to be chosen. */
export type ImportMode = "draft" | "publish";

export interface WriteTarget {
  projectId: string;
  dataset: string;
}

export class WriteTargetError extends Error {}

/** Why the importer can't write to this dataset, or null when it can. */
export function writableDatasetProblem(dataset: string) {
  if (!dataset) return "The Studio didn't say which dataset it uses, so nothing can be imported.";
  if (WRITABLE_DATASETS.includes(dataset)) return null;
  return dataset === "production"
    ? "Imports into production aren't switched on yet. Only the development dataset can be imported into."
    : `Imports into "${dataset}" aren't switched on. Only the development dataset can be imported into.`;
}

/** Why the importer can't publish into this dataset, or null when it can. */
export function publishableDatasetProblem(dataset: string) {
  const problem = writableDatasetProblem(dataset);
  if (problem) return problem;
  return PUBLISHABLE_DATASETS.includes(dataset) ? null : `Publishing into "${dataset}" isn't switched on.`;
}

/** Only what the check reads from a Sanity client. */
export interface ConfiguredClient {
  config(): { projectId?: string; dataset?: string };
}

/**
 * Throws unless the client points at the workspace's project and dataset, and
 * that dataset is writable (and publishable, when publishing). Returns the
 * checked target.
 */
export function assertWriteTarget(client: ConfiguredClient, workspace: WriteTarget, mode: ImportMode = "draft"): WriteTarget {
  const { projectId = "", dataset = "" } = client.config();
  if (!projectId || projectId !== workspace.projectId) {
    throw new WriteTargetError(
      `The Studio client uses project "${projectId || "unknown"}", but this workspace is "${workspace.projectId}". Reload the Studio; nothing was written.`
    );
  }
  if (dataset !== workspace.dataset) {
    throw new WriteTargetError(
      `The Studio client uses dataset "${dataset || "unknown"}", but this workspace is "${workspace.dataset}". Reload the Studio; nothing was written.`
    );
  }
  const problem = mode === "publish" ? publishableDatasetProblem(dataset) : writableDatasetProblem(dataset);
  if (problem) throw new WriteTargetError(problem);
  return { projectId, dataset };
}
