import type { SupabaseClient } from "@supabase/supabase-js";
import { homePathForRole, isAdminRole } from "@/lib/admin/roles";
import { getSafeRedirect } from "@/lib/auth/redirect";
import { BUSINESS_DASHBOARD_HREF } from "@/lib/business/entry";

export const CUSTOMER_HOME = "/wishlists";
export const BUSINESS_HOME = BUSINESS_DASHBOARD_HREF;

/**
 * Where to send someone who has just signed in. An explicit, safe return path
 * (a shared wishlist they were viewing, say) always wins. Otherwise team
 * members land on their role's admin home, business accounts on the HR
 * dashboard, and customers on their wishlists.
 * `supabase` must carry the new session.
 */
export async function postSignInDestination(
  supabase: SupabaseClient,
  requested?: string | null,
): Promise<string> {
  const explicit = getSafeRedirect(requested, "");
  if (explicit) return explicit;

  try {
    const { data: role, error } = await supabase.rpc("gifvtme_current_user_admin_role");
    if (!error && isAdminRole(role)) return homePathForRole(role);
  } catch {
    // Role lookup unavailable (e.g. migration 041 not applied): customer home.
  }

  try {
    const { data: accountType, error } = await supabase.rpc("gifvtme_current_user_account_type");
    if (!error && accountType === "business") return BUSINESS_HOME;
  } catch {
    // Account type unavailable (e.g. migration 042 not applied): customer home.
  }
  return CUSTOMER_HOME;
}
