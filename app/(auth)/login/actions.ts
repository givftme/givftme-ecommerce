"use server";

import { validatePublicAuthEnv } from "@/lib/env";
import { getSafeRedirect } from "@/lib/auth/redirect";
import {
  type AuthActionResult,
  type LoginValues,
  loginSchema,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  values: LoginValues & { redirectTo?: string | null }
): Promise<AuthActionResult> {
  validatePublicAuthEnv();

  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: "Incorrect email or password.",
    };
  }

  return {
    success: true,
    redirectTo: getSafeRedirect(values.redirectTo),
  };
}
