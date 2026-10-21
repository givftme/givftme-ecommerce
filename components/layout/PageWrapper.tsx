import { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/profile";
import type { AccountType } from "@/lib/business/entry";
import { getMaxFlashSaleDiscountPercent, normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { FLASH_SALE_PRODUCTS_QUERY } from "@/lib/sanity/queries";
import type { ProductCardData } from "@/lib/sanity/types";

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
  const user = await getCurrentUser();
  const resolvedIsAuthenticated = isAuthenticated ?? Boolean(user);

  let profileName: string | undefined;
  let avatarUrl: string | undefined;
  let accountType: AccountType | undefined;

  if (user) {
    const profile = await getCurrentProfile(user.id);

    profileName = profile.full_name?.trim().split(/\s+/)[0] || undefined;
    avatarUrl = profile.avatar_url || undefined;
    accountType = profile.account_type ?? undefined;
  }

  const resolvedUserName = userName ?? profileName ?? getUserDisplayName(user);

  // Powers the navbar's flash sale strip on every public page — a small,
  // short-revalidated fetch (see FLASH_SALE_PRODUCTS_QUERY's usage
  // elsewhere) rather than per-page prop drilling.
  const rawFlashSaleProducts = await sanityFetch<ProductCardData[]>(
    FLASH_SALE_PRODUCTS_QUERY,
    { now: new Date().toISOString(), offset: 0, limit: 8 }
  );
  const flashSaleProducts = normalizeProductCards(rawFlashSaleProducts);
  const flashSaleEndTime = flashSaleProducts[0]?.saleEndTime ?? null;
  const flashSaleMaxDiscountPercent = getMaxFlashSaleDiscountPercent(flashSaleProducts);

  return (
    <PublicPageShell
      userName={resolvedUserName}
      avatarUrl={avatarUrl}
      isAuthenticated={resolvedIsAuthenticated}
      accountType={accountType}
      searchQuery={searchQuery}
      flashSaleEndTime={flashSaleEndTime}
      flashSaleMaxDiscountPercent={flashSaleMaxDiscountPercent}
    >
      {children}
    </PublicPageShell>
  );
}
