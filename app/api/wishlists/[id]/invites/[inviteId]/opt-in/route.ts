import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { scheduleInviteeReminders } from "@/lib/reminders/scheduleInviteeReminders";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface InviteOptInRouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

function getOccasionDate(row: unknown) {
  const wishlist = row as
    | {
        occasions?:
          | { occasion_date?: string | null }
          | Array<{ occasion_date?: string | null }>
          | null;
      }
    | null;
  const occasion = Array.isArray(wishlist?.occasions)
    ? wishlist?.occasions[0]
    : wishlist?.occasions;

  return occasion?.occasion_date || null;
}

export async function POST(
  _request: Request,
  context: InviteOptInRouteContext
) {
  const { id, inviteId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const { data: wishlistId, error } = await supabase.rpc(
    "gifvtme_opt_in_wishlist_invite",
    { p_invite_id: inviteId }
  );

  if (error || wishlistId !== id) {
    return jsonError("Couldn't opt into reminders.", error ? 500 : 404);
  }

  const { data: wishlist, error: wishlistError } = await supabase
    .from("wishlists")
    .select("id, occasions(id, occasion_date)")
    .eq("id", id)
    .maybeSingle();

  if (wishlistError) {
    console.error("Could not load reminder occasion.", wishlistError);
    return NextResponse.json({ ok: true, reminders_scheduled: false });
  }

  const occasionDate = getOccasionDate(wishlist);

  if (occasionDate) {
    try {
      await scheduleInviteeReminders({
        supabase,
        userId: user.id,
        inviteId,
        occasionDate,
      });
      return NextResponse.json({ ok: true, reminders_scheduled: true });
    } catch (scheduleError) {
      console.error("Invitee reminder scheduling failed.", scheduleError);
    }
  }

  return NextResponse.json({ ok: true, reminders_scheduled: false });
}
