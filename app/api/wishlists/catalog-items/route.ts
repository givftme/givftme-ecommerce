import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedApiUser,
  getWishlistedCatalogProductIds,
} from "@/lib/wishlist/server";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getAuthenticatedApiUser(supabase);

    if (!user) {
      return NextResponse.json(
        { catalogProductIds: [] },
        { headers: NO_STORE_HEADERS }
      );
    }

    const catalogProductIds = await getWishlistedCatalogProductIds(
      supabase,
      user.id
    );

    return NextResponse.json(
      { catalogProductIds },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return jsonError("Couldn't check wishlisted items.", 500, NO_STORE_HEADERS);
  }
}
