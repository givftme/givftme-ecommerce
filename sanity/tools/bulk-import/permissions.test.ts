import { describe, expect, it } from "vitest";
import type { DraftProductDocument } from "@/sanity/tools/bulk-import/documents";
import { checkDraftCreate, checkPublishCreate, firstValue } from "@/sanity/tools/bulk-import/permissions";

type Permission = "create" | "update";

/**
 * Stands in for the Studio's grants store: answers synchronously, as the
 * real one can, from a rule given the permission and the exact document.
 */
function grantsStore(allow: (permission: Permission, document: { _id: string }) => boolean) {
  const calls: [Permission, string][] = [];
  return {
    calls,
    store: {
      checkDocumentPermission: (permission: Permission, document: { _id: string }) => ({
        subscribe: ({ next }: { next: (value: { granted: boolean; reason: string }) => void }) => {
          calls.push([permission, document._id]);
          const granted = allow(permission, document);
          next({ granted, reason: granted ? "Matching grant" : "No matching grants found" });
          return { unsubscribe: () => undefined };
        },
      }),
    } as never,
  };
}

const draft = { _id: "drafts.product-bag", _type: "product", title: "Bag" } as DraftProductDocument;
const isDraft = (document: { _id: string }) => document._id.startsWith("drafts.");

describe("checkDraftCreate", () => {
  it("asks whether the draft itself may be created", async () => {
    const { store, calls } = grantsStore(() => true);
    await expect(checkDraftCreate(store, draft)).resolves.toEqual({ granted: true, reason: "Matching grant" });
    expect(calls).toEqual([["create", "drafts.product-bag"]]);
  });

  it("refuses to check anything but a product draft, since a null document counts as granted", async () => {
    const { store, calls } = grantsStore(() => true);
    await expect(checkDraftCreate(store, { ...draft, _id: "product-bag" } as never)).rejects.toThrow("Only product drafts");
    await expect(checkDraftCreate(store, { ...draft, _type: "collection" } as never)).rejects.toThrow("Only product drafts");
    await expect(checkDraftCreate(store, null as never)).rejects.toThrow("Only product drafts");
    expect(calls).toEqual([]);
  });
});

describe("checkPublishCreate", () => {
  it("checks the draft, removing it, and creating the published document with the same content", async () => {
    const { store, calls } = grantsStore(() => true);
    await expect(checkPublishCreate(store, draft)).resolves.toEqual({ granted: true, reason: "May create and publish" });
    expect(calls).toEqual([
      ["create", "drafts.product-bag"],
      ["update", "drafts.product-bag"],
      ["create", "product-bag"],
    ]);
  });

  it("refuses a role that may only work on drafts, like Contributor", async () => {
    const { store } = grantsStore((_permission, document) => isDraft(document));
    await expect(checkPublishCreate(store, draft)).resolves.toEqual({
      granted: false,
      reason: "Can't create the published document: No matching grants found",
    });
  });

  it("refuses when the draft can't be removed", async () => {
    const { store } = grantsStore((permission) => permission === "create");
    await expect(checkPublishCreate(store, draft)).resolves.toEqual({
      granted: false,
      reason: "Can't remove the draft when it's published: No matching grants found",
    });
  });

  it("refuses when the draft can't be created, without asking further", async () => {
    const { store, calls } = grantsStore(() => false);
    await expect(checkPublishCreate(store, draft)).resolves.toEqual({
      granted: false,
      reason: "Can't create the draft: No matching grants found",
    });
    expect(calls).toEqual([["create", "drafts.product-bag"]]);
  });

  it("evaluates grants against the document's content, as filters on fields do", async () => {
    const { store } = grantsStore((_permission, document) => (document as { title?: string }).title === "Bag");
    await expect(checkPublishCreate(store, draft)).resolves.toMatchObject({ granted: true });
    await expect(checkPublishCreate(store, { ...draft, title: "Other" })).resolves.toMatchObject({ granted: false });
  });
});

describe("firstValue", () => {
  it("takes the first value, even one emitted synchronously, and unsubscribes", async () => {
    let unsubscribed = 0;
    const source = {
      subscribe: ({ next }: { next: (value: number) => void }) => {
        next(1);
        next(2);
        return { unsubscribe: () => void (unsubscribed += 1) };
      },
    };
    await expect(firstValue(source as never)).resolves.toBe(1);
    expect(unsubscribed).toBe(1);
  });
});
