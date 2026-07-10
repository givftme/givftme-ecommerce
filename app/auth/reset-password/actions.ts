"use server";

import { validateAuthEnv } from "@/lib/env";
import {
  type AuthActionResult,
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function resetPasswordAction(
  values: ResetPasswordValues
): Promise<AuthActionResult> {
  validateAuthEnv();

  const parsed = resetPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Couldn't update your password. Try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: "Couldn't update your password. Try again.",
    };
  }

  return {
    success: true,
  };
}
