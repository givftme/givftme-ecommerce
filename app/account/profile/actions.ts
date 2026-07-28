"use server";

import { validateAuthEnv } from "@/lib/env";
import { isValidDeleteConfirmation } from "@/lib/account/validation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Orders in these statuses represent in-flight fulfillment work the internal
// ops team (Retool) is tracking — deleting the account would cascade-delete
// the order and lose that visibility. See BUSINESS_RULES.md for context.
const BLOCKING_ORDER_STATUSES = ["confirmed", "under_review", "forwarded", "shipped"];

export type DeleteAccountResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function deleteAccountAction(confirmation: string): Promise<DeleteAccountResult> {
  if (!isValidDeleteConfirmation(confirmation)) {
    return { success: false, error: "Type DELETE to confirm." };
  }

  validateAuthEnv();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You need to sign in first." };
  }

  const { data: activeOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", user.id)
    .in("status", BLOCKING_ORDER_STATUSES)
    .limit(1);

  if (ordersError) {
    return {
      success: false,
      error: "Account deletion failed. Please try again or contact support.",
    };
  }

  if (activeOrders && activeOrders.length > 0) {
    return {
      success: false,
      error:
        "You have an active order. Please wait for it to be delivered before deleting your account.",
    };
  }

  const serviceClient = createServiceClient();
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return {
      success: false,
      error: "Account deletion failed. Please try again or contact support.",
    };
  }

  await supabase.auth.signOut();

  return { success: true, redirectTo: "/?deleted=true" };
}
