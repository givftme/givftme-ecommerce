import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { listAdminOrders, parseOrderFilters } from "@/lib/admin/data/orders";
import { jsonError } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdminApi("orders", { audit: { action: "list_orders", targetType: "screen", targetId: "orders" } });
  if (!auth.ok) return auth.response;
  const filters = parseOrderFilters(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listAdminOrders(auth.service, filters));
  } catch (error) {
    console.error("Could not list orders.", error);
    return jsonError("Couldn't load orders. Try again.", 500);
  }
}
