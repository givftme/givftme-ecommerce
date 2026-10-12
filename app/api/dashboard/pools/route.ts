import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getDashboardPools } from "@/lib/pools/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  try {
    return NextResponse.json(await getDashboardPools(user.id));
  } catch (error) {
    console.error("Could not load group gift pools dashboard.", error);
    return jsonError("Couldn't load your pools. Try again.", 500);
  }
}
