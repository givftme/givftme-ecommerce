import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(withRedirect("/login", "/account"));
  const { data: profile, error } = await supabase.from("users")
    .select("full_name, avatar_url").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Couldn't load your account. Please try again.");
  return (
    <PageWrapper isAuthenticated>
      <AccountShell name={profile?.full_name || "Your account"} email={user.email || ""} avatarUrl={profile?.avatar_url || null}>
        {children}
      </AccountShell>
    </PageWrapper>
  );
}
