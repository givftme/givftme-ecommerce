import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import {
  assertOccasionOwner,
  getOwnedOccasionDetail,
  rescheduleOccasionReminders,
} from "@/lib/occasion/server";
import { updateOccasionSchema } from "@/lib/occasion/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { deleteUnsentOccasionReminders } from "@/lib/reminders/scheduleOccasionReminders";

interface OccasionRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: OccasionRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  try {
    const occasion = await getOwnedOccasionDetail(supabase, user.id, id);

    if (!occasion) {
      return jsonError("Occasion not found.", 404);
    }

    return NextResponse.json({ occasion });
  } catch {
    return jsonError("Couldn't load occasion.", 500);
  }
}

export async function PATCH(request: Request, context: OccasionRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertOccasionOwner>>;

  try {
    owner = await assertOccasionOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify occasion access.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  if (owner.occasion.status === "archived") {
    return jsonError("Archived occasions can't be edited.", 409);
  }

  const body = await readJson(request);
  const parsed = updateOccasionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check the occasion details and try again.", 400);
  }

  const updates = parsed.data;
  const dateChanged =
    updates.occasion_date !== undefined &&
    updates.occasion_date !== owner.occasion.occasion_date;

  const { data, error } = await supabase
    .from("occasions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, occasion_type, occasion_date, status, archived_at")
    .single();

  if (error || !data) {
    return jsonError("Couldn't update occasion. Try again.", 500);
  }

  if (updates.title) {
    await supabase
      .from("wishlists")
      .update({ title: updates.title })
      .eq("occasion_id", id)
      .eq("user_id", user.id)
      .eq("type", "occasion");
  }

  if (dateChanged && updates.occasion_date) {
    await rescheduleOccasionReminders({
      supabase,
      userId: user.id,
      occasionDate: updates.occasion_date,
    });
  }

  return NextResponse.json({ occasion: data });
}

export async function DELETE(_request: Request, context: OccasionRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  let owner: Awaited<ReturnType<typeof assertOccasionOwner>>;

  try {
    owner = await assertOccasionOwner(supabase, id, user.id);
  } catch {
    return jsonError("Couldn't verify occasion access.", 500);
  }

  if (!owner.ok) {
    return jsonError(owner.error, owner.status);
  }

  const { error } = await supabase
    .from("occasions")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError("Couldn't archive occasion. Try again.", 500);
  }

  await deleteUnsentOccasionReminders({ supabase, userId: user.id });

  return new NextResponse(null, { status: 204 });
}
