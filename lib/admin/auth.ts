import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api/response";
import { logAdminAction, type AdminActionInput } from "@/lib/admin/audit";
import {
  canAccessScreen,
  canPerform,
  isAdminRole,
  type AdminAction,
  type AdminRole,
  type AdminScreen,
} from "@/lib/admin/roles";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

// Gift candidates and pricing predate team roles and still authorize against
// the ADMIN_EMAILS allowlist. The /admin proxy gate now also requires a role.
export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.toLowerCase());
}

export async function getAdminApiUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const user = await getAuthenticatedApiUser(supabase);
  return user && isAdminEmail(user.email) ? user : null;
}

export async function requireAdminPageUser() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    redirect(withRedirect("/login", "/admin/gift-candidates"));
  }

  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return user;
}

export interface AdminTeamMember {
  id: string;
  role: AdminRole;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * The signed-in team member, or null for customers and visitors. The role is
 * read with the service role, so it never depends on what a customer's
 * session may select from public.users.
 */
async function loadTeamMember(user: User): Promise<AdminTeamMember | null> {
  const { data, error } = await createServiceClient()
    .from("users")
    .select("role, full_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load team role: ${error.message}`);
  if (!isAdminRole(data?.role)) return null;
  return {
    id: user.id,
    role: data.role,
    fullName: data.full_name || user.email || "Team member",
    email: data.email || user.email || "",
    avatarUrl: data.avatar_url ?? null,
  };
}

/** Deduplicated per request, so the layout and page share one lookup. */
export const getAdminSession = cache(async () => {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return { user: null, member: null } as const;
  return { user, member: await loadTeamMember(user) } as const;
});

/** Any team role; used by the admin layout. */
export async function requireTeamMember(path = "/admin"): Promise<AdminTeamMember> {
  const { user, member } = await getAdminSession();
  if (!user) redirect(withRedirect("/login", path));
  if (!member) redirect("/?error=unauthorized");
  return member;
}

/**
 * Page guard: redirects anyone whose role can't open `screen`, then logs the
 * view to admin_actions (privacy rule 4).
 */
export async function requireAdminScreen(
  screen: AdminScreen,
  options: { path: string; targetType?: string; targetId?: string; action?: string } = { path: "/admin" },
): Promise<AdminTeamMember> {
  const member = await requireTeamMember(options.path);
  if (!canAccessScreen(member.role, screen)) redirect("/admin/pulse");

  await logAdminAction(createServiceClient(), member.id, {
    action: options.action ?? "view_screen",
    targetType: options.targetType ?? "screen",
    targetId: options.targetId ?? screen,
    metadata: { path: options.path },
  });
  return member;
}

export type AdminApiAuth =
  | { ok: true; member: AdminTeamMember; service: SupabaseClient }
  | { ok: false; response: Response };

/**
 * Route guard for /api/admin/*: 401 without a session, 403 without a role
 * that can open `screen` (and perform `action`, when given). Read routes pass
 * `audit` so the access itself is logged; mutations log their own outcome.
 */
export async function requireAdminApi(
  screen: AdminScreen,
  options: { action?: AdminAction; audit?: AdminActionInput } = {},
): Promise<AdminApiAuth> {
  try {
    const supabase = await createClient();
    const user = await getAuthenticatedApiUser(supabase);
    if (!user) return { ok: false, response: jsonError("You need to sign in first.", 401) };
    const member = await loadTeamMember(user);
    if (!member || !canAccessScreen(member.role, screen) || (options.action && !canPerform(member.role, options.action))) {
      return { ok: false, response: jsonError("Your role doesn't have access to this.", 403) };
    }
    const service = createServiceClient();
    if (options.audit) await logAdminAction(service, member.id, options.audit);
    return { ok: true, member, service };
  } catch (error) {
    console.error("Could not authorize admin request.", error);
    return { ok: false, response: jsonError("Couldn't verify your access. Try again.", 500) };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}
