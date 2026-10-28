import type { GrantsStore } from "sanity";
import type { DraftProductDocument } from "./documents";

// Asks the Studio's grants store whether the editor may create a given draft,
// before anything is written. This is a preflight, not the authority: the
// Content Lake still checks every write, and a 401 or 403 from it stops the
// import. Role names (access.ts) only choose which notice to show.

export interface PermissionAnswer {
  granted: boolean;
  reason: string;
}

interface Subscribable<T> {
  subscribe(observer: { next: (value: T) => void; error: (error: unknown) => void }): { unsubscribe(): void };
}

/** The first value an observable emits, without adding rxjs as a dependency. */
export function firstValue<T>(source: Subscribable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let subscription: { unsubscribe(): void } | null = null;
    const settle = () => {
      settled = true;
      subscription?.unsubscribe();
    };
    subscription = source.subscribe({
      next: (value) => {
        if (settled) return;
        settle();
        resolve(value);
      },
      error: (error) => {
        if (settled) return;
        settle();
        reject(error);
      },
    });
    // The store may answer synchronously, before `subscription` was assigned.
    if (settled) subscription.unsubscribe();
  });
}

/**
 * Whether the editor may create this draft. The store evaluates the editor's
 * dataset grants against the document exactly as given, so it's always the
 * `drafts.` document that will be created. A null document would count as
 * granted, so it's refused here.
 */
export function checkDraftCreate(grants: Pick<GrantsStore, "checkDocumentPermission">, document: DraftProductDocument) {
  if (!document?._id?.startsWith("drafts.") || document._type !== "product") {
    return Promise.reject(new Error("Only product drafts can be checked."));
  }
  return firstValue<PermissionAnswer>(grants.checkDocumentPermission("create", document));
}

/**
 * Whether the editor may create this product and publish it in one go. The
 * same grants the Studio's own Publish button needs (`getPairPermissions` for
 * "publish"), plus creating the draft that the request makes first:
 * - create the draft,
 * - update the draft, which publishing deletes,
 * - create the published document, with the draft's content.
 * There's no published document yet, so updating one needs no grant.
 */
export async function checkPublishCreate(
  grants: Pick<GrantsStore, "checkDocumentPermission">,
  document: DraftProductDocument
): Promise<PermissionAnswer> {
  const draft = await checkDraftCreate(grants, document);
  if (!draft.granted) return { granted: false, reason: `Can't create the draft: ${draft.reason}` };
  const checks: [string, ReturnType<GrantsStore["checkDocumentPermission"]>][] = [
    ["remove the draft when it's published", grants.checkDocumentPermission("update", document)],
    ["create the published document", grants.checkDocumentPermission("create", { ...document, _id: document._id.slice("drafts.".length) })],
  ];
  for (const [label, check] of checks) {
    const answer = await firstValue<PermissionAnswer>(check);
    if (!answer.granted) return { granted: false, reason: `Can't ${label}: ${answer.reason}` };
  }
  return { granted: true, reason: "May create and publish" };
}
