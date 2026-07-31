import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import {
  createImportantDate,
  getImportantDates,
  ImportantDateInputError,
} from "@/lib/important-dates/server";
import { importantDateSchema } from "@/lib/important-dates/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const dates = await getImportantDates(supabase, user.id);
    return NextResponse.json({ dates });
  } catch {
    return jsonError("Couldn't load your dates.", 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = importantDateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Check the date details and try again.", 400);
  }

  try {
    const date = await createImportantDate({ supabase, userId: user.id, input: parsed.data });
    return NextResponse.json({ date }, { status: 201 });
  } catch (error) {
    console.error("Couldn't create important date.", error);

    if (error instanceof ImportantDateInputError) {
      return jsonError(error.message, 400);
    }

    return jsonError("Couldn't save this date. Try again.", 500);
  }
}
