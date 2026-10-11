import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { getOrderPageForUser } from "@/lib/orders/server";
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
  const requestedGroup = searchParams.get("tab") ?? searchParams.get("status");
  const parsedGroup = parseGroup(requestedGroup);
  if (requestedGroup && !parsedGroup) return jsonError("Choose a valid order tab.", 400);
  const group = parsedGroup || "active";
  const rawPage = searchParams.get("page") || "1";
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1) {
    return jsonError("Page must be a positive number.", 400);
  }

  try {
    const result = await getOrderPageForUser(supabase, user.id, group, page);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Couldn't load orders.", error);
    return jsonError("Couldn't load your orders.", 500);
  }
}
