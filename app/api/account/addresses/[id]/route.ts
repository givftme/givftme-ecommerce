import {
  DELETE as deleteAddress,
  PATCH as patchAddress,
} from "@/app/api/addresses/[id]/route";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return patchAddress(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return deleteAddress(request, context);
}
