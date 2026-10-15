import type { SupabaseClient } from "@supabase/supabase-js";

// Orders in these statuses represent in-flight fulfillment work the internal
// ops team is tracking — deleting the account would cascade-delete the order
// and lose that visibility. See BUSINESS_RULES.md for context.
export const BLOCKING_ORDER_STATUSES = ["confirmed", "under_review", "forwarded", "shipped"];

export type AccountDeletionResult =
  | { success: true }
  | { success: false; reason: "active_order" | "failed" };

/**
 * The single account deletion path, shared by the customer's own Delete
 * Account action and the admin People screen. `ordersClient` reads the
 * blocking-order check (the customer's session, or the service role).
 */
export async function deleteUserAccount(
  ordersClient: SupabaseClient,
  serviceClient: SupabaseClient,
  userId: string,
): Promise<AccountDeletionResult> {
  const { data: activeOrders, error: ordersError } = await ordersClient
    .from("orders")
    .select("id")
    .eq("buyer_id", userId)
    .in("status", BLOCKING_ORDER_STATUSES)
    .limit(1);

  if (ordersError) return { success: false, reason: "failed" };
  if (activeOrders && activeOrders.length > 0) return { success: false, reason: "active_order" };

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
  return deleteError ? { success: false, reason: "failed" } : { success: true };
}
