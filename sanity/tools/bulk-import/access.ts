// Sanity's built-in project roles. The Content Lake enforces the real grants on
// every write; this only decides what the tool offers and which notice to show.
const PUBLISH_ROLES = ["administrator", "editor", "developer"];
const DRAFT_ROLES = ["contributor"];
const READ_ONLY_ROLES = ["viewer"];

/**
 * `publish` — may create drafts and published products.
 * `drafts` — may create drafts only (Contributor).
 * `none` — read-only (Viewer).
 * `unknown` — custom role; writes are attempted and Sanity's response decides.
 */
export type ImportAccess = "publish" | "drafts" | "none" | "unknown";

export function getImportAccess(roleNames: readonly string[]): ImportAccess {
  if (roleNames.some((role) => PUBLISH_ROLES.includes(role))) return "publish";
  if (roleNames.some((role) => DRAFT_ROLES.includes(role))) return "drafts";
  if (roleNames.length > 0 && roleNames.every((role) => READ_ONLY_ROLES.includes(role))) {
    return "none";
  }
  return "unknown";
}
