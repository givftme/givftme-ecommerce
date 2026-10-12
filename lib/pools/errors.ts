export function poolRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("not_authenticated")) return { status: 401, error: "You need to sign in first." };
  if (message.includes("not_found")) return { status: 404, error: "This pool or wishlist couldn't be found." };
  if (message.includes("forbidden")) return { status: 403, error: "You can't manage this pool." };
  if (message.includes("pool_closed")) return { status: 409, error: "This pool is no longer accepting contributions." };
  if (message.includes("pool_cancelled")) return { status: 409, error: "This pool has already been cancelled." };
  if (message.includes("has_contributions")) return { status: 400, error: "This pool has received contributions and cannot be cancelled. You can cash out instead." };
  if (message.includes("minimum_contribution:")) {
    const minimum = message.split("minimum_contribution:").pop()?.match(/[\d.]+/)?.[0] ?? "1,500";
    return { status: 400, error: `Minimum contribution is ₦${new Intl.NumberFormat("en-NG").format(Number(minimum))}.` };
  }
  if (message.includes("invalid_target")) return { status: 400, error: "Target must be at least ₦1,500." };
  if (message.includes("invalid_minimum")) return { status: 400, error: "Minimum contribution must be between ₦1,500 and ₦5,000." };
  if (message.includes("invalid_message")) return { status: 400, error: "Messages can be up to 300 characters." };
  if (message.includes("invalid_title")) return { status: 400, error: "Pool title must be between 3 and 100 characters." };
  if (message.includes("invalid_amount")) return { status: 400, error: "Enter a valid contribution amount." };
  if (message.includes("idempotency_key_conflict")) return { status: 409, error: "This payment request has already been used." };
  if (message.includes("item_unavailable")) return { status: 409, error: "This wishlist item is no longer available." };
  if (message.includes("item_reserved")) return { status: 409, error: "Someone has already reserved this gift." };
  if (message.includes("pool_not_ready_for_procurement")) return { status: 409, error: "This item pool is not ready for procurement." };
  return { status: 500, error: "Couldn't complete the pool request. Try again." };
}
