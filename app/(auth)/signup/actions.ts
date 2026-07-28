"use server";

import { getAppUrl, validateAuthEnv } from "@/lib/env";
import { getSafeRedirect } from "@/lib/auth/redirect";
import {
  type AuthActionResult,
  type SignupValues,
  signupSchema,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function signupAction(
  values: SignupValues & { redirectTo?: string | null }
): Promise<AuthActionResult> {
  validateAuthEnv();

  const parsed = signupSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }

  const supabase = await createClient();
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`;
  const redirectTo = getSafeRedirect(values.redirectTo, "/login");
  const emailRedirectTo = new URL("/callback", getAppUrl());
  emailRedirectTo.searchParams.set("redirect", redirectTo);

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: emailRedirectTo.toString(),
    },
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("already") || message.includes("registered")) {
      return {
        success: false,
        error: "An account with this email already exists. Try logging in.",
        errorCode: "email_already_registered",
      };
    }

    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "unknown",
    };
  }

  return {
    success: true,
    message: "Check your email to verify your account",
  };
}
