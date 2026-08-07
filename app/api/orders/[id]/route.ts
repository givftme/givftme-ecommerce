import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getOrderDetail } from "@/lib/orders/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const order = await getOrderDetail(supabase, id, user.id);

    if (!order) {
      return jsonError("This order doesn't exist.", 404);
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Couldn't load order.", error);
    return jsonError("Couldn't load this order.", 500);
  }
}
