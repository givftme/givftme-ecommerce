"use server";

import { validateAuthEnv } from "@/lib/env";
import {
  type AuthActionResult,
  type ForgotPasswordValues,
  forgotPasswordSchema,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function sendPasswordOtpAction(
  values: ForgotPasswordValues
): Promise<AuthActionResult> {
  validateAuthEnv();

  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }

  const supabase = await createClient();

  // Supabase Authentication must have Email OTP enabled, not only magic links,
  // for the 6-digit password reset code expected by this flow.
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      success: true,
    };
  }

  return {
    success: true,
  };
}
