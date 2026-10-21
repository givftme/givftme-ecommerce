import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { signInBusiness } from "@/lib/business-dashboard/account";
import { businessSignInSchema } from "@/lib/business-dashboard/validation";
import { validatePublicAuthEnv } from "@/lib/env";

// Business dashboard sign-in: password auth that only succeeds for members
// of a business account. Sets the Supabase session cookies.
export async function POST(request: Request) {
  validatePublicAuthEnv();
  const parsed = businessSignInSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check your details and try again.", 400);

  const result = await signInBusiness(parsed.data);
  if (!result.ok) {
    // The code lets the sign-in screen react, e.g. offer to resend the confirmation link.
    return result.code
      ? NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
      : jsonError(result.error, result.status);
  }
  return NextResponse.json({ redirectTo: result.redirectTo });
}
