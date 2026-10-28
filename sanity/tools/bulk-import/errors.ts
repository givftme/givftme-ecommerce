// Sorts errors from Sanity's client into what the importer does next. A
// response with a 4xx status (other than 429) means the request was refused,
// so nothing was written. No status, or a 5xx, means the answer was lost: the
// write may or may not have happened.

export function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

/** The session can't do this: stop the whole import. */
export function isAuthError(error: unknown) {
  const status = statusOf(error);
  return status === 401 || status === 403;
}

/** Refused outright, so it definitely didn't happen. */
export function isRefused(error: unknown) {
  const status = statusOf(error);
  return status !== null && status >= 400 && status < 500;
}

/** A short reason for the editor. Sanity's own description when it gives one; never a stack or headers. */
export function describeError(error: unknown) {
  const status = statusOf(error);
  const details = (error as { details?: { description?: unknown } } | null)?.details?.description;
  const message = typeof details === "string" && details ? details : error instanceof Error ? error.message : "";
  const reason = message.split("\n")[0].slice(0, 200) || "No details were given.";
  if (status === 401 || status === 403) return `Sanity refused the request (${status}): ${reason}`;
  if (status === 429) return "Sanity is rate-limiting requests. Wait a minute, then retry.";
  return status ? `Sanity answered ${status}: ${reason}` : `No answer from Sanity: ${reason}`;
}
