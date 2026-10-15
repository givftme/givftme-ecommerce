import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { updateAdminOrderStatus } from "@/lib/admin/data/orders";
import { orderStatusUpdateSchema } from "@/lib/admin/validation";
import { jsonError, readJson } from "@/lib/api/response";

interface OrderRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: OrderRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Order not found.", 404);

  const auth = await requireAdminApi("orders", { action: "updateOrderStatus" });
  if (!auth.ok) return auth.response;

  const parsed = orderStatusUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the status details and try again.", 400);

  try {
    const result = await updateAdminOrderStatus(auth.service, auth.member.id, id, parsed.data);
    return result.ok ? NextResponse.json({ status: result.status }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not update order status.", error);
    return jsonError("Couldn't update the order. Try again.", 500);
  }
}
