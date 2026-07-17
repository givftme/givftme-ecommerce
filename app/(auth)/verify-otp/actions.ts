"use server";

import { validateAuthEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function verifyOtpAction({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  validateAuthEnv();

  if (!email || !/^\d{6}$/.test(token)) {
    return {
      success: false,
      error: "That code is incorrect. Try again or resend.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    const message = error.message.toLowerCase();

    return {
      success: false,
      error: message.includes("expired")
        ? "That code has expired. Request a new one."
        : "That code is incorrect. Try again or resend.",
    };
  }

  return {
    success: true,
  };
}
