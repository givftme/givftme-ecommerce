import { randomUUID } from "node:crypto";

const UUID_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, "i");
const TRANSACTION_REF_PREFIX = "gifvtme_order";
const TRANSACTION_REF_PATTERN = new RegExp(
  `^${TRANSACTION_REF_PREFIX}_(${UUID_SOURCE})_[0-9a-f-]{36}$`,
  "i"
);

export function createFlutterwaveTransactionRef(orderId: string) {
  return `${TRANSACTION_REF_PREFIX}_${orderId}_${randomUUID()}`;
}

export function getOrderIdFromFlutterwaveReference(
  transactionRef: string | null | undefined
) {
  if (!transactionRef) {
    return null;
  }

  if (UUID_PATTERN.test(transactionRef)) {
    return transactionRef;
  }

  return TRANSACTION_REF_PATTERN.exec(transactionRef)?.[1] ?? null;
}

export function getOrderIdFromFlutterwaveMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const orderId = (meta as { order_id?: unknown }).order_id;

  return typeof orderId === "string" && UUID_PATTERN.test(orderId)
    ? orderId
    : null;
}
