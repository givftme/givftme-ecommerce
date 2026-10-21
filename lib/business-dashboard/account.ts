import { headers } from "next/headers";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/business-dashboard/auth";
import type { BusinessSignInValues, BusinessSignUpValues } from "@/lib/business-dashboard/validation";
import { getAppUrl } from "@/lib/env";
import { eventContextFromHeaders } from "@/lib/events/context";
import { recordRequestEvent } from "@/lib/events/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Lets the auth screen react: resend a confirmation link, or point elsewhere. */
export type BusinessAuthErrorCode = "email_not_confirmed" | "not_business" | "account_incomplete";

export type BusinessAuthResult =
  | { ok: true; redirectTo: string; needsConfirmation: boolean }
  | { ok: false; status: number; error: string; code?: BusinessAuthErrorCode };

// Personal and business logins are separate (BUSINESS_RULES 38), so an email
// already in use must not send the visitor back and forth between the tabs.
export const EMAIL_IN_USE_MESSAGE =
  "This email already has a Givftme account. If it's your business login, sign in instead. If it's a personal account, use a different (work) email: personal and business accounts are separate.";
export const NOT_BUSINESS_MESSAGE =
  "This email is a personal Givftme account. Business accounts are separate, so use the personal sign-in link below, or create a business account with a different (work) email.";
export const ACCOUNT_INCOMPLETE_MESSAGE =
  "This login is set up for Givftme for Business but isn't fully linked to a company account. Message our team and we'll restore access.";

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
    return { ok: false, status: 409, error: EMAIL_IN_USE_MESSAGE };
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
    if (data.session) await supabase.auth.signOut({ scope: "local" });
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

/**
 * Password sign-in that only succeeds for members of a business account whose
 * users.account_type is also 'business' (proxy.ts gates the dashboard on it).
 * Any other login is signed out of this device only, so a personal account
 * typed in here stays signed in on the visitor's other devices.
 */
export async function signInBusiness(values: BusinessSignInValues): Promise<BusinessAuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });
  // Supabase only reports this once the password matched, so it is safe to
  // tell the owner their sign-up is waiting on the confirmation link.
  if (error?.code === "email_not_confirmed") {
    return {
      ok: false,
      status: 403,
      error: "Confirm your email first. Open the link we sent you, or send a new one.",
      code: "email_not_confirmed",
    };
  }
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Incorrect email or password." };
  }

  const service = createServiceClient();
  const [{ data: membership, error: memberError }, { data: profile }] = await Promise.all([
    service.from("business_users").select("id").eq("user_id", data.user.id).limit(1).maybeSingle(),
    service.from("users").select("account_type").eq("id", data.user.id).maybeSingle(),
  ]);
  const isBusinessType = profile?.account_type === "business";
  if (!memberError && membership && isBusinessType) {
    return { ok: true, redirectTo: BUSINESS_DASHBOARD_PATH, needsConfirmation: false };
  }

  await supabase.auth.signOut({ scope: "local" });
  if (memberError) {
    console.error("Could not check business membership at sign-in.", memberError);
    return { ok: false, status: 503, error: "We couldn't check your business account. Please try again." };
  }
  if (membership || isBusinessType) {
    return { ok: false, status: 403, error: ACCOUNT_INCOMPLETE_MESSAGE, code: "account_incomplete" };
  }
  return { ok: false, status: 403, error: NOT_BUSINESS_MESSAGE, code: "not_business" };
}
