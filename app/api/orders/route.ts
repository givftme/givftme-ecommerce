import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getOrdersForUser } from "@/lib/orders/server";
import type { OrderStatusGroup } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

const VALID_GROUPS: OrderStatusGroup[] = ["active", "completed", "cancelled"];

function parseGroup(value: string | null): OrderStatusGroup | undefined {
  if (!value) return undefined;
  return (VALID_GROUPS as string[]).includes(value)
    ? (value as OrderStatusGroup)
    : undefined;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const { searchParams } = new URL(request.url);
  const group = parseGroup(searchParams.get("status"));

  try {
    const orders = await getOrdersForUser(supabase, user.id, group);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Couldn't load orders.", error);
    return jsonError("Couldn't load your orders.", 500);
  }
}
