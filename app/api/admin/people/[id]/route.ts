import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { deletePersonAsAdmin, getPersonRecord } from "@/lib/admin/data/people";
import { personDeletionSchema } from "@/lib/admin/validation";
import { jsonError, readJson } from "@/lib/api/response";

interface PersonRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: PersonRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Person not found.", 404);

  const auth = await requireAdminApi("people", { audit: { action: "view_person", targetType: "user", targetId: id } });
  if (!auth.ok) return auth.response;
  try {
    const person = await getPersonRecord(auth.service, id);
    return person ? NextResponse.json({ person }) : jsonError("Person not found.", 404);
  } catch (error) {
    console.error("Could not load person record.", error);
    return jsonError("Couldn't load this person. Try again.", 500);
  }
}

export async function DELETE(request: Request, context: PersonRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Person not found.", 404);

  const auth = await requireAdminApi("people");
  if (!auth.ok) return auth.response;

  const parsed = personDeletionSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Type DELETE and give a reason.", 400);

  try {
    const result = await deletePersonAsAdmin(auth.service, auth.member.id, id, parsed.data.reason);
    return result.ok ? NextResponse.json({ deleted: true }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not delete person.", error);
    return jsonError("Account deletion failed. Try again.", 500);
  }
}
