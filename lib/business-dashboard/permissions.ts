import type { BusinessRole } from "@/lib/business-dashboard/data";

// The spec's "Permissions (within the business dashboard)" table. Viewing is
// open to every role; `limited` members only see campaigns they own and never
// the budget.
export const BUSINESS_PERMISSIONS = {
  edit_people: ["admin", "editor"],
  edit_campaigns: ["admin", "editor"],
  approve_campaigns: ["admin", "approver"],
  edit_brand: ["admin", "editor"],
  view_budget: ["admin", "approver", "editor"],
  manage_team: ["admin"],
} as const satisfies Record<string, readonly BusinessRole[]>;

export type BusinessPermission = keyof typeof BUSINESS_PERMISSIONS;

export function canBusiness(role: BusinessRole, permission: BusinessPermission): boolean {
  return (BUSINESS_PERMISSIONS[permission] as readonly BusinessRole[]).includes(role);
}

export const NO_PERMISSION_MESSAGE = "You don't have permission to do that.";
export const SAVE_FAILED_MESSAGE = "Couldn't save. Please try again.";
