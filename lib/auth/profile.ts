import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AccountType } from "@/lib/business/entry";
import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  full_name: string | null;
  avatar_url: string | null;
  /** Null when unknown: the column arrives with migration 042, or the read failed. */
  account_type: AccountType | null;
}

function toAccountType(value: unknown): AccountType | null {
  return value === "business" || value === "consumer" ? value : null;
}

/**
 * The signed-in user's own public.users row. If the select with account_type
 * fails (migration 042 not applied, say), it reads name and avatar alone so
 * the navbar keeps them.
 */
export async function readProfile(supabase: SupabaseClient, userId: string): Promise<CurrentProfile> {
  const withType = await supabase
    .from("users")
    .select("full_name, avatar_url, account_type")
    .eq("id", userId)
    .maybeSingle();
  if (!withType.error) {
    return {
      full_name: withType.data?.full_name ?? null,
      avatar_url: withType.data?.avatar_url ?? null,
      account_type: toAccountType(withType.data?.account_type),
    };
  }

  const basic = await supabase.from("users").select("full_name, avatar_url").eq("id", userId).maybeSingle();
  return {
    full_name: basic.data?.full_name ?? null,
    avatar_url: basic.data?.avatar_url ?? null,
    account_type: null,
  };
}

/** The signed-in user, read once per request (PageWrapper and getBusinessSession share it). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in user's profile, read once per request. */
export const getCurrentProfile = cache(async (userId: string): Promise<CurrentProfile> => {
  return readProfile(await createClient(), userId);
});
