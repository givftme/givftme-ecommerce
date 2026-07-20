import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { newsletterSchema } from "@/lib/newsletter/validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = newsletterSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Enter a valid email address", 400);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.email });

  if (error?.code === "23505") {
    return jsonError("You're already subscribed.", 409);
  }

  if (error) {
    return jsonError("Couldn't subscribe. Try again.", 500);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
