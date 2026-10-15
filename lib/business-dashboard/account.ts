import { headers } from "next/headers";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/business-dashboard/auth";
import type { BusinessSignInValues, BusinessSignUpValues } from "@/lib/business-dashboard/validation";
import { getAppUrl } from "@/lib/env";
import { eventContextFromHeaders } from "@/lib/events/context";
import { recordRequestEvent } from "@/lib/events/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type BusinessAuthResult =
  | { ok: true; redirectTo: string; needsConfirmation: boolean }
  | { ok: false; status: number; error: string };

/**
 * Creates the auth user (Supabase signUp, so the existing email confirmation
 * applies), then the business_accounts, business_users and account_type flag
 * in one database transaction. If that transaction fails the auth user is
 * deleted, so a failed signup never leaves a half-made account.
 */
export async function signUpBusiness(values: BusinessSignUpValues): Promise<BusinessAuthResult> {
  const supabase = await createClient();
  const service = createServiceClient();
  const emailRedirectTo = new URL("/callback", getAppUrl());
  emailRedirectTo.searchParams.set("redirect", BUSINESS_DASHBOARD_PATH);
  const signupCity = eventContextFromHeaders(await headers()).city;

  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        // Read by the user_signed_up trigger (migration 041) for attribution.
        signup_channel: "business",
        company_name: values.companyName,
        ...(signupCity ? { signup_city: signupCity } : {}),
      },
      emailRedirectTo: emailRedirectTo.toString(),
    },
  });

  const message = error?.message.toLowerCase() ?? "";
  // With email confirmation on, Supabase returns a user with no identities
  // instead of an error when the email is already registered.
  const alreadyRegistered =
    message.includes("already") || message.includes("registered") || (data.user && data.user.identities?.length === 0);
  if (alreadyRegistered) {
    return { ok: false, status: 409, error: "An account with this email already exists. Sign in instead." };
  }
  if (error || !data.user) {
    return { ok: false, status: 500, error: "Something went wrong. Please try again." };
  }

  const { data: accountId, error: createError } = await service.rpc("gifvtme_create_business_account", {
    p_user_id: data.user.id,
    p_company_name: values.companyName,
    p_department: values.role,
  });
  if (createError || !accountId) {
    console.error("Could not create business account.", createError);
    if (data.session) await supabase.auth.signOut();
    const { error: deleteError } = await service.auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Could not remove auth user after a failed business signup.", deleteError);
    return { ok: false, status: 500, error: "We couldn't create your account. Please try again." };
  }

  await recordRequestEvent({
    event: "business.account.created",
    userId: data.user.id,
    props: { account_id: accountId, role: values.role },
  });

  return { ok: true, redirectTo: BUSINESS_DASHBOARD_PATH, needsConfirmation: !data.session };
}

/** Password sign-in that only succeeds for members of a business account. */
export async function signInBusiness(values: BusinessSignInValues): Promise<BusinessAuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Incorrect email or password." };
  }

  const { data: membership, error: memberError } = await createServiceClient()
    .from("business_users")
    .select("id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (memberError || !membership) {
    await supabase.auth.signOut();
    return {
      ok: false,
      status: 403,
      error: "This email isn't linked to a business account. Create one instead.",
    };
  }

  return { ok: true, redirectTo: BUSINESS_DASHBOARD_PATH, needsConfirmation: false };
}
