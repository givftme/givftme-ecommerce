import { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { createClient } from "@/lib/supabase/server";

export interface PageWrapperProps {
  children: ReactNode;
  cartCount?: number;
  userName?: string;
  isAuthenticated?: boolean;
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
  cartCount,
  userName,
  isAuthenticated,
}: PageWrapperProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedIsAuthenticated = isAuthenticated ?? Boolean(user);
  const resolvedUserName = userName ?? getUserDisplayName(user);

  return (
    <>
      <Navbar
        cartCount={cartCount}
        userName={resolvedUserName}
        isAuthenticated={resolvedIsAuthenticated}
      />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
    </>
  );
}
