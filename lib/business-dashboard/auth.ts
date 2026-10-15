import { jsonError } from "@/lib/api/response";
import { canBusiness, NO_PERMISSION_MESSAGE, type BusinessPermission } from "@/lib/business-dashboard/permissions";
import { getBusinessSession } from "@/lib/business-dashboard/queries";
import type { BusinessMember } from "@/lib/business-dashboard/types";

export const BUSINESS_DASHBOARD_PATH = "/business-dashboard";
export const BUSINESS_AUTH_PATH = "/business-dashboard/auth";

export type MemberCheck =
  | { ok: true; member: BusinessMember }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Server actions receive the account id from the browser, so every mutation
 * re-resolves the session and confirms the caller belongs to that account
 * and holds the permission before touching a row.
 */
export async function checkBusinessMember(
  accountId: string | null,
  permission?: BusinessPermission,
): Promise<MemberCheck> {
  const { user, member } = await getBusinessSession();
  if (!user) return { ok: false, status: 401, error: "Your session has ended. Sign in again." };
  if (!member || (accountId !== null && member.account_id !== accountId)) {
    return { ok: false, status: 403, error: NO_PERMISSION_MESSAGE };
  }
  if (permission && !canBusiness(member.role, permission)) {
    return { ok: false, status: 403, error: NO_PERMISSION_MESSAGE };
  }
  return { ok: true, member };
}

/** Route handler guard: the member, or a JSON error response. */
export async function requireBusinessApi(permission?: BusinessPermission) {
  const check = await checkBusinessMember(null, permission);
  if (!check.ok) return { member: null, response: jsonError(check.error, check.status) } as const;
  return { member: check.member, response: null } as const;
}
