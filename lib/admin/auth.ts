import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

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
