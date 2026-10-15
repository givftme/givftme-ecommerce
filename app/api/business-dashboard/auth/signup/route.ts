import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { signUpBusiness } from "@/lib/business-dashboard/account";
import { businessSignUpSchema } from "@/lib/business-dashboard/validation";
import { validateAuthEnv } from "@/lib/env";

// Creates a business account: the auth user plus business_accounts,
// business_users and users.account_type in one transaction.
export async function POST(request: Request) {
  validateAuthEnv();
  const parsed = businessSignUpSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check your details and try again.", 400);

  const result = await signUpBusiness(parsed.data);
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(
    { redirectTo: result.redirectTo, needsConfirmation: result.needsConfirmation },
    { status: 201 },
  );
}
