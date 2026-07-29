import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import {
  createOccasionWithWishlist,
  getOccasionSummaries,
} from "@/lib/occasion/server";
import { createOccasionSchema } from "@/lib/occasion/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const occasions = await getOccasionSummaries(supabase, user.id);
    return NextResponse.json({ occasions });
  } catch {
    return jsonError("Couldn't load occasions.", 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = createOccasionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check the occasion details and try again.", 400);
  }

  try {
    const result = await createOccasionWithWishlist({
      supabase,
      userId: user.id,
      input: parsed.data,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("master_item_id") ||
        error.message.includes("gifvtme_create_occasion_with_wishlist"))
    ) {
      return jsonError("Run the occasion wishlist migration before creating occasions.", 409);
    }

    console.error("Occasion creation failed.", error);
    return jsonError("Couldn't create occasion. Try again.", 500);
  }
}
