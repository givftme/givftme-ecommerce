import type { SanityClient } from "sanity";
import { BULK_IMPORT_PRODUCT_CHECK_QUERY } from "@/lib/sanity/queries";
import {
  buildDraftDocument,
  draftIdFor,
  fieldsAddedSince,
  matchesAttempt,
  PLACEHOLDER_ASSET_ID,
  type DraftProductDocument,
} from "./documents";
import { describeError, isAuthError, isRefused, statusOf } from "./errors";
import type { LocalImage } from "./images";
import type { ImageMatchResult, ProductImageMatch } from "./matching";
import type { PermissionAnswer } from "./permissions";
import { fetchSanityIndex, LookupError, resolveImport, type ProductResolution, type ResolutionResult, type SanityIndex } from "./resolve";
import { assertWriteTarget, WriteTargetError, type WriteTarget } from "./safety";
import type { ImportPlan, PlannedProduct } from "./types";
import { uploadImages } from "./uploads";

// Phase 5A: creates the previewed products as drafts. Writes are limited to
// `client.assets.upload` and `client.create` with a `drafts.` ID; nothing is
// patched, replaced, deleted or published.
//
// 1. The write target is checked (allowlisted dataset, same project and
//    dataset as the workspace). It's checked again before every upload and
//    every create.
// 2. Drafts whose create got no clear answer last time are read back first;
//    only a draft holding exactly what was sent counts as created.
// 3. The dataset is read again and every product rechecked with the Phase 4
//    rules. Products that became blocked are skipped.
// 4. Each draft is checked against the editor's permissions and the schema,
//    before anything is uploaded.
// 5. The images those products need are uploaded, each file once.
// 6. Drafts are created one at a time. Just before each, that product's ID,
//    slug, SKUs and references are read once more; a conflict found then is
//    a failure. The finished draft, with its image assets, is validated
//    against the schema again (which also confirms every reference, assets
//    included, points at an existing document), and the dataset rechecked.
//    `create` refuses an ID that exists, so nothing is overwritten.
//
// Slugs and SKUs can't be reserved: Sanity has no uniqueness constraint for
// them, so another editor can still take one between the last check and the
// create. The final read keeps that window to one request.

export type ProductImportStatus = "created" | "skipped" | "failed" | "uncertain" | "not-attempted";

export interface ProductImportResult {
  handle: string;
  title: string;
  documentId: string;
  draftId: string;
  status: ProductImportStatus;
  message: string;
  /** Whether trying again could succeed. */
  retryable: boolean;
}

export type StopReason = "cancelled" | "permission" | "target" | "check" | "error";

export interface ImportRun {
  target: WriteTarget;
  /** The products this run looked at, in spreadsheet order. */
  results: ProductImportResult[];
  stopped: { reason: StopReason; message: string } | null;
  uploads: { uploaded: number; reused: number; failed: number };
}

/** Kept across retries of one preview, so nothing is uploaded or created twice. */
export interface ImportSession {
  /** Assets uploaded in this session, by local file. */
  assets: Map<LocalImage, string>;
  /** Drafts created (or confirmed) in this session: document ID → draft ID. */
  created: Map<string, string>;
  /** Creates that got no clear answer, with the document that was sent. */
  uncertain: Map<string, DraftProductDocument>;
}

export const createImportSession = (): ImportSession => ({ assets: new Map(), created: new Map(), uncertain: new Map() });

export type ImportProgress =
  | { phase: "checking" }
  | { phase: "uploading"; done: number; total: number }
  | { phase: "creating"; done: number; total: number; title: string };

export interface DraftImportRequest {
  plan: ImportPlan;
  images: ImageMatchResult;
  /** The Phase 4 check the editor reviewed; only its importable products are considered. */
  preview: ResolutionResult;
  /** Limits the run to these document IDs, for a retry. */
  only?: ReadonlySet<string>;
  session: ImportSession;
}

export interface ValidationProblem {
  level: "error" | "warning" | "info";
  message: string;
}

export interface ValidateOptions {
  getDocumentExists?: (options: { id: string }) => Promise<boolean>;
}

export interface DraftImportDeps {
  /** The editor's own Studio client; never one with a server token. */
  client: SanityClient;
  workspace: WriteTarget;
  checkPermission: (document: DraftProductDocument) => Promise<PermissionAnswer>;
  /** Sanity's schema validation; `getDocumentExists` replaces its reference lookups when given. */
  validate: (document: DraftProductDocument, options?: ValidateOptions) => Promise<ValidationProblem[]>;
  shouldStop?: () => boolean;
  onProgress?: (progress: ImportProgress) => void;
}

const NOT_ATTEMPTED: Record<StopReason, string> = {
  cancelled: "Not attempted: the import was stopped.",
  permission: "Not attempted: the import stopped after a permission error.",
  target: "Not attempted: the dataset check failed.",
  check: "Not attempted: the Studio couldn't be checked again.",
  error: "Not attempted: the import stopped after an unexpected error.",
};

const messagesOf = (resolution: ProductResolution) => resolution.skipReasons.map((entry) => entry.message).join(" ");

function imagesOf(match: ProductImageMatch | undefined) {
  return [...(match?.gallery ?? []), ...(match?.variantImages ?? [])].flatMap((slot) => (slot.image ? [slot.image] : []));
}

/** The run must use the exact plan the preview checked. */
function previewMatches(plan: ImportPlan, preview: ResolutionResult) {
  return (
    preview.products.length === plan.products.length &&
    preview.products.every((entry, index) => entry.documentId === plan.products[index].documentId)
  );
}

/** One read for one product, as close to its create as possible, judged by the Phase 4 rules. */
async function recheckProduct(
  client: SanityClient,
  plan: ImportPlan,
  images: ImageMatchResult,
  product: PlannedProduct,
  match: ProductImageMatch | undefined
): Promise<ProductResolution> {
  const skus = [product.fields.baseSku, ...(product.fields.variants ?? []).map((variant) => variant.sku)]
    .filter((sku): sku is string => Boolean(sku))
    .map((sku) => sku.toLowerCase());
  const result = await client.withConfig({ perspective: "raw", useCdn: false }).fetch<Partial<SanityIndex> | null>(
    BULK_IMPORT_PRODUCT_CHECK_QUERY,
    {
      id: product.documentId,
      draftId: draftIdFor(product.documentId),
      versionPath: `versions.*.${product.documentId}`,
      slug: product.fields.slug.current.toLowerCase(),
      skus,
      collectionSlugs: product.collectionSlugs.map((slug) => slug.toLowerCase()),
    }
  );
  const index: SanityIndex = {
    products: result?.products ?? [],
    collections: result?.collections ?? [],
    suppliers: result?.suppliers ?? [],
  };
  return resolveImport(
    { ...plan, products: [product], rejectedHandles: [] },
    { ...images, products: match ? [match] : [] },
    index
  ).products[0];
}

export async function runDraftImport(request: DraftImportRequest, deps: DraftImportDeps): Promise<ImportRun> {
  const { plan, images, preview, only, session } = request;
  const { client } = deps;
  const shouldStop = deps.shouldStop ?? (() => false);
  const progress = deps.onProgress ?? (() => undefined);

  const planned = new Map(plan.products.map((product) => [product.documentId, product]));
  const matches = new Map(images.products.map((match) => [match.documentId, match]));
  const results = new Map<string, ProductImportResult>();
  const uploads = { uploaded: 0, reused: 0, failed: 0 };
  let target = deps.workspace;
  let stopped: ImportRun["stopped"] = null;

  const record = (product: PlannedProduct, status: ProductImportStatus, message: string, retryable = false) => {
    results.set(product.documentId, {
      handle: product.handle,
      title: product.fields.title,
      documentId: product.documentId,
      draftId: draftIdFor(product.documentId),
      status,
      message,
      retryable,
    });
  };
  // Products this run considers; any left without a result when it stops weren't attempted.
  const considered: PlannedProduct[] = [];
  const stop = (reason: StopReason, message: string) => {
    stopped = { reason, message };
    for (const product of considered) {
      if (!results.has(product.documentId)) record(product, "not-attempted", NOT_ATTEMPTED[reason], true);
    }
  };
  const finish = (): ImportRun => ({
    target,
    results: plan.products.flatMap((product) => results.get(product.documentId) ?? []),
    stopped,
    uploads,
  });

  for (const entry of preview.products) {
    const product = planned.get(entry.documentId);
    if (!product || (only && !only.has(entry.documentId)) || session.created.has(entry.documentId)) continue;
    if (entry.outcome === "blocked") {
      record(product, "skipped", `Blocked in the Studio check: ${messagesOf(entry)}`);
    } else {
      considered.push(product);
    }
  }

  try {
    target = assertWriteTarget(client, deps.workspace);
  } catch (error) {
    stop("target", error instanceof Error ? error.message : "The dataset couldn't be checked.");
    return finish();
  }
  if (!previewMatches(plan, preview)) {
    stop("check", "The Studio check doesn't match this spreadsheet. Run it again.");
    return finish();
  }
  const recheckTarget = () => assertWriteTarget(client, target);

  try {
    progress({ phase: "checking" });

    // Earlier creates with no clear answer: read the draft back before trying again.
    const queue: PlannedProduct[] = [];
    for (const product of considered) {
      const attempted = session.uncertain.get(product.documentId);
      if (attempted) {
        let existing: Record<string, unknown> | undefined;
        try {
          existing = await client.getDocument(attempted._id);
        } catch (error) {
          if (isAuthError(error)) {
            stop("permission", describeError(error));
            return finish();
          }
          record(product, "uncertain", `Still couldn't tell whether the draft was created. ${describeError(error)}`, true);
          continue;
        }
        session.uncertain.delete(product.documentId);
        if (existing && matchesAttempt(existing, attempted)) {
          session.created.set(product.documentId, attempted._id);
          const added = fieldsAddedSince(existing, attempted);
          record(
            product,
            "created",
            `Created as ${attempted._id} by the earlier attempt; confirmed by reading it back.${
              added.length ? ` It has since been edited (${added.join(", ")}).` : ""
            }`
          );
          continue;
        }
        if (existing) {
          record(product, "failed", `A different draft now exists at ${attempted._id}. It was left unchanged.`);
          continue;
        }
      }
      queue.push(product);
    }
    if (!queue.length) return finish();

    // The dataset may have changed since the preview: check every product again.
    let index: SanityIndex;
    try {
      index = await fetchSanityIndex(client);
    } catch (error) {
      stop("check", error instanceof LookupError ? error.message : "Couldn't check the Studio again.");
      return finish();
    }
    const fresh = new Map(resolveImport(plan, images, index).products.map((entry) => [entry.documentId, entry]));

    // Permissions and schema, before anything is uploaded.
    const valid: { product: PlannedProduct; match: ProductImageMatch | undefined }[] = [];
    for (const product of queue) {
      const now = fresh.get(product.documentId)!;
      if (now.outcome === "blocked") {
        record(product, "skipped", `Blocked since the Studio check: ${messagesOf(now)}`);
        continue;
      }
      if (shouldStop()) {
        stop("cancelled", "The import was stopped before anything was uploaded.");
        return finish();
      }
      const match = matches.get(product.documentId);
      let document: DraftProductDocument;
      try {
        document = buildDraftDocument(product, now, match ?? null, null);
      } catch (error) {
        record(product, "failed", error instanceof Error ? error.message : "The draft couldn't be built.");
        continue;
      }

      let permission: PermissionAnswer;
      try {
        permission = await deps.checkPermission(document);
      } catch {
        stop("permission", "Couldn't check your Sanity permissions, so nothing was uploaded or created.");
        return finish();
      }
      if (!permission.granted) {
        record(product, "failed", `Your Sanity role can't create this draft. ${permission.reason}`.trim(), true);
        stop("permission", "Your Sanity role can't create product drafts here, so nothing was uploaded or created.");
        return finish();
      }

      let problems: ValidationProblem[];
      try {
        problems = (await deps.validate(document)).filter((problem) => problem.level === "error");
      } catch (error) {
        record(product, "failed", `Couldn't check it against the product schema. ${describeError(error)}`, true);
        continue;
      }
      if (problems.length) {
        record(product, "failed", `Doesn't match the product schema: ${problems.map((problem) => problem.message).join("; ")}`);
        continue;
      }
      valid.push({ product, match });
    }

    // Each image once; files already uploaded in this session are reused.
    const needed = [...new Set(valid.flatMap((item) => imagesOf(item.match)))];
    const toUpload = needed.filter((image) => !session.assets.has(image));
    uploads.reused = needed.length - toUpload.length;
    if (toUpload.length) {
      progress({ phase: "uploading", done: 0, total: toUpload.length });
      const uploaded = await uploadImages(client, toUpload, {
        shouldStop,
        beforeEach: recheckTarget,
        onUploaded: (done) => progress({ phase: "uploading", done, total: toUpload.length }),
      });
      for (const [image, outcome] of uploaded.outcomes) {
        if (outcome.status === "uploaded") {
          session.assets.set(image, outcome.assetId);
          uploads.uploaded += 1;
        } else {
          uploads.failed += 1;
        }
      }
      if (uploaded.halt) {
        const { halt } = uploaded;
        stop(
          halt.reason,
          halt.reason === "cancelled" ? "The import was stopped while images were uploading; no drafts were created." : halt.message
        );
        return finish();
      }
      for (const { product, match } of valid) {
        const missing = imagesOf(match).find((image) => !session.assets.has(image));
        if (!missing) continue;
        const outcome = uploaded.outcomes.get(missing);
        const reason = outcome?.status === "failed" ? outcome.message : "it wasn't uploaded";
        record(product, "failed", `${missing.filename} couldn't be uploaded (${reason}), so the draft wasn't created.`, true);
      }
    }

    // One draft at a time.
    const creatable = valid.filter((item) => !results.has(item.product.documentId));
    for (const [position, { product, match }] of creatable.entries()) {
      progress({ phase: "creating", done: position, total: creatable.length, title: product.fields.title });
      if (shouldStop()) {
        stop("cancelled", "The import was stopped. Drafts created before then are kept.");
        break;
      }
      try {
        recheckTarget();
      } catch (error) {
        stop("target", error instanceof WriteTargetError ? error.message : "The dataset couldn't be checked.");
        break;
      }

      let resolution: ProductResolution;
      try {
        resolution = await recheckProduct(client, plan, images, product, match);
      } catch (error) {
        if (isAuthError(error)) {
          stop("permission", describeError(error));
          break;
        }
        record(product, "failed", `Couldn't check for conflicts, so the draft wasn't created. ${describeError(error)}`, true);
        continue;
      }
      if (resolution.outcome === "blocked") {
        record(product, "failed", `A conflict appeared after the check, so the draft wasn't created: ${messagesOf(resolution)}`);
        continue;
      }

      let document: DraftProductDocument;
      try {
        document = buildDraftDocument(product, resolution, match ?? null, (image) => session.assets.get(image));
      } catch (error) {
        record(product, "failed", error instanceof Error ? error.message : "The draft couldn't be built.");
        continue;
      }

      // The finished draft, image assets and all, must pass the schema too.
      let problems: ValidationProblem[];
      try {
        problems = (await deps.validate(document)).filter((problem) => problem.level === "error");
      } catch (error) {
        record(product, "failed", `Couldn't check the finished draft against the schema. ${describeError(error)}`, true);
        continue;
      }
      if (problems.length) {
        record(
          product,
          "failed",
          `The finished draft doesn't match the product schema, so it wasn't created: ${problems.map((problem) => problem.message).join("; ")}`
        );
        continue;
      }
      try {
        recheckTarget();
      } catch (error) {
        stop("target", error instanceof WriteTargetError ? error.message : "The dataset couldn't be checked.");
        break;
      }

      try {
        await client.create(document);
        session.created.set(product.documentId, document._id);
        record(product, "created", `Created as ${document._id}.`);
      } catch (error) {
        if (isAuthError(error)) {
          record(product, "failed", describeError(error), true);
          stop("permission", "Sanity refused a write, so the import stopped.");
          break;
        }
        if (statusOf(error) === 409) {
          record(product, "failed", `A document with the ID ${document._id} was created after the check. Nothing was changed.`);
        } else if (isRefused(error)) {
          record(product, "failed", `Sanity refused the draft. ${describeError(error)}`, statusOf(error) === 429);
        } else {
          // The draft may exist. A retry reads it back before creating anything.
          session.uncertain.set(product.documentId, document);
          record(product, "uncertain", `${describeError(error)} The draft may or may not have been created; a retry checks first.`, true);
        }
      }
    }
  } catch (error) {
    console.error("Bulk import: the draft import stopped unexpectedly", error);
    stop("error", "Something went wrong, so the import stopped. Drafts created before then are kept.");
  }
  return finish();
}

export interface PreflightResult {
  target: WriteTarget;
  stopped: { reason: "target" | "check"; message: string } | null;
  products: {
    handle: string;
    title: string;
    draftId: string;
    status: "ready" | "skipped" | "failed";
    message: string;
  }[];
  /** Distinct files the ready products would upload. */
  uploads: { images: number; bytes: number };
}

/**
 * The import's checks without its writes: the write target, a fresh recheck,
 * the editor's permission to create each draft, and the schema for each
 * complete draft. Images that aren't uploaded yet stand in as a placeholder
 * asset, and references are looked up in the freshly read dataset. Only
 * reads; nothing is uploaded or created.
 */
export async function runDraftPreflight(
  request: Omit<DraftImportRequest, "only" | "session">,
  deps: Pick<DraftImportDeps, "client" | "workspace" | "checkPermission" | "validate">
): Promise<PreflightResult> {
  const { plan, images, preview } = request;
  const { client } = deps;
  const result: PreflightResult = { target: deps.workspace, stopped: null, products: [], uploads: { images: 0, bytes: 0 } };

  try {
    result.target = assertWriteTarget(client, deps.workspace);
  } catch (error) {
    result.stopped = { reason: "target", message: error instanceof Error ? error.message : "The dataset couldn't be checked." };
    return result;
  }
  if (!previewMatches(plan, preview)) {
    result.stopped = { reason: "check", message: "The Studio check doesn't match this spreadsheet. Run it again." };
    return result;
  }

  let index: SanityIndex;
  try {
    index = await fetchSanityIndex(client);
  } catch (error) {
    result.stopped = { reason: "check", message: error instanceof LookupError ? error.message : "Couldn't check the Studio again." };
    return result;
  }
  const fresh = resolveImport(plan, images, index);
  const published = new Set(
    [...index.products, ...index.collections, ...index.suppliers]
      .map((document) => document._id)
      .filter((id) => !id.startsWith("drafts.") && !id.startsWith("versions."))
  );
  const getDocumentExists = async ({ id }: { id: string }) => id === PLACEHOLDER_ASSET_ID || published.has(id);
  const matches = new Map(images.products.map((match) => [match.documentId, match]));
  const uploads = new Map<LocalImage, number>();

  for (const [position, product] of plan.products.entries()) {
    const now = fresh.products[position];
    const entry = { handle: product.handle, title: product.fields.title, draftId: draftIdFor(product.documentId) };
    if (preview.products[position].outcome === "blocked" || now.outcome === "blocked") {
      result.products.push({ ...entry, status: "skipped", message: messagesOf(now.outcome === "blocked" ? now : preview.products[position]) });
      continue;
    }
    const match = matches.get(product.documentId);
    try {
      const document = buildDraftDocument(product, now, match ?? null, () => PLACEHOLDER_ASSET_ID);
      const permission = await deps.checkPermission(document);
      if (!permission.granted) {
        result.products.push({ ...entry, status: "failed", message: `Your Sanity role can't create this draft. ${permission.reason}`.trim() });
        continue;
      }
      const problems = (await deps.validate(document, { getDocumentExists })).filter((problem) => problem.level === "error");
      if (problems.length) {
        result.products.push({
          ...entry,
          status: "failed",
          message: `Doesn't match the product schema: ${problems.map((problem) => problem.message).join("; ")}`,
        });
        continue;
      }
    } catch (error) {
      result.products.push({ ...entry, status: "failed", message: `Couldn't be checked. ${describeError(error)}` });
      continue;
    }
    for (const image of imagesOf(match)) uploads.set(image, image.size);
    result.products.push({ ...entry, status: "ready", message: "Would be created as a draft." });
  }

  result.uploads = { images: uploads.size, bytes: [...uploads.values()].reduce((total, size) => total + size, 0) };
  return result;
}

/** Assets uploaded in this session that no created draft uses. Reported, never deleted. */
export function unusedAssets(session: ImportSession, images: ImageMatchResult) {
  const used = new Set<LocalImage>();
  for (const match of images.products) {
    if (session.created.has(match.documentId)) for (const image of imagesOf(match)) used.add(image);
  }
  return [...session.assets]
    .filter(([image]) => !used.has(image))
    .map(([image, assetId]) => ({ filename: image.filename, assetId }));
}
