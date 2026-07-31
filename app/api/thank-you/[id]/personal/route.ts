import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { sendPersonalThankYou } from "@/lib/thank-you/server";
import { personalThankYouSchema } from "@/lib/thank-you/validation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface PersonalThankYouRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: PersonalThankYouRouteContext,
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = personalThankYouSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message || "Check your message and try again.",
      400,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError("Couldn't send your message. Please try again.", 500);
  }

  try {
    const result = await sendPersonalThankYou({
      supabase,
      serviceClient: createServiceClient(),
      userId: user.id,
      receiverName:
        (profile as { full_name?: string } | null)?.full_name || "Someone",
      id,
      source: parsed.data.source,
      message: parsed.data.message,
    });

    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Couldn't send personal thank-you.", error);
    return jsonError("Couldn't send your message. Please try again.", 500);
  }
}
