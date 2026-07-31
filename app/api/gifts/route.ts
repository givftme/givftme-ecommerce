import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getGiftsReceived } from "@/lib/thank-you/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const gifts = await getGiftsReceived(supabase, user.id);
    return NextResponse.json({ gifts });
  } catch (error) {
    console.error("Couldn't load gifts received.", error);
    return jsonError("Couldn't load your gifts.", 500);
  }
}
