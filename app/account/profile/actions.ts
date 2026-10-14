"use server";

import { z } from "zod";
import { validateAuthEnv } from "@/lib/env";
import {
  isValidDeleteConfirmation,
  profileSchema,
} from "@/lib/account/validation";
import { deleteUserAccount } from "@/lib/account/deletion";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type AccountActionResult =
  | { success: true }
  | { success: false; error: string };

export async function updateProfileAction(input: unknown): Promise<AccountActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Check your details and try again." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You need to sign in first." };
  }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      default_thank_you_msg: parsed.data.default_thank_you_msg || null,
    })
    .eq("id", user.id);

  return error
    ? { success: false, error: "Couldn't save changes. Try again." }
    : { success: true };
}

export async function requestEmailChangeAction(email: string): Promise<AccountActionResult> {
  const parsedEmail = z.string().trim().email().toLowerCase().safeParse(email);
  if (!parsedEmail.success) {
    return { success: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You need to sign in first." };
  }

  const { error } = await supabase.auth.updateUser({ email: parsedEmail.data });
  return error
    ? { success: false, error: "Couldn't request an email change. Try again." }
    : { success: true };
}

export type DeleteAccountResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function deleteAccountAction(confirmation: string): Promise<DeleteAccountResult> {
  if (!isValidDeleteConfirmation(confirmation)) {
    return { success: false, error: "Type DELETE to confirm." };
  }

  validateAuthEnv();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You need to sign in first." };
  }

  const result = await deleteUserAccount(supabase, createServiceClient(), user.id);

  if (!result.success) {
    return {
      success: false,
      error: result.reason === "active_order"
        ? "You have an active order. Please wait for it to be delivered before deleting your account."
        : "Account deletion failed. Please try again or contact support.",
    };
  }

  await supabase.auth.signOut();

  return { success: true, redirectTo: "/" };
}
