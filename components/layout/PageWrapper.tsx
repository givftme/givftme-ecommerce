import { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { createClient } from "@/lib/supabase/server";

export interface PageWrapperProps {
  children: ReactNode;
  cartCount?: number;
  userName?: string;
  isAuthenticated?: boolean;
  searchQuery?: string;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" ? value.trim() : "";
}

function getUserDisplayName(user: User | null) {
  if (!user) {
    return undefined;
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const fullName =
    getMetadataString(metadata, "full_name") ||
    getMetadataString(metadata, "name");
  const firstName =
    getMetadataString(metadata, "first_name") ||
    getMetadataString(metadata, "given_name");
  const displayName = fullName || firstName;

  return displayName ? displayName.split(/\s+/)[0] : undefined;
}

export async function PageWrapper({
  children,
  userName,
  isAuthenticated,
  searchQuery,
}: PageWrapperProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedIsAuthenticated = isAuthenticated ?? Boolean(user);

  let profileName: string | undefined;
  let avatarUrl: string | undefined;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    profileName = profile?.full_name?.trim().split(/\s+/)[0] || undefined;
    avatarUrl = profile?.avatar_url || undefined;
  }

  const resolvedUserName = userName ?? profileName ?? getUserDisplayName(user);

  return (
    <PublicPageShell
      userName={resolvedUserName}
      avatarUrl={avatarUrl}
      isAuthenticated={resolvedIsAuthenticated}
      searchQuery={searchQuery}
    >
      {children}
    </PublicPageShell>
  );
}
