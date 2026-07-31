import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import {
  assertImportantDateOwner,
  deleteImportantDate,
  updateImportantDate,
} from "@/lib/important-dates/server";
import { updateImportantDateSchema } from "@/lib/important-dates/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ImportantDateRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: ImportantDateRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertImportantDateOwner>>;

  try {
    owner = await assertImportantDateOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify access to this date.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  const body = await readJson(request);
  const parsed = updateImportantDateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message || "Check the date details and try again.",
      400
    );
  }

  try {
    const date = await updateImportantDate({
      supabase,
      userId: user.id,
      id,
      existing: owner.importantDate,
      input: parsed.data,
    });

    return NextResponse.json({ date });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Couldn't update this date.",
      400
    );
  }
}

export async function DELETE(_request: Request, context: ImportantDateRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertImportantDateOwner>>;

  try {
    owner = await assertImportantDateOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify access to this date.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  try {
    await deleteImportantDate({ supabase, userId: user.id, id });
  } catch {
    return jsonError("Couldn't delete this date. Try again.", 500);
  }

  return NextResponse.json({ deleted: true });
}
