import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedApiUser,
  getWishlistedCatalogProductIds,
} from "@/lib/wishlist/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return NextResponse.json({ catalogProductIds: [] });
  }

  try {
    const catalogProductIds = await getWishlistedCatalogProductIds(
      supabase,
      user.id
    );

    return NextResponse.json({ catalogProductIds });
  } catch {
    return jsonError("Couldn't check wishlisted items.", 500);
  }
}
