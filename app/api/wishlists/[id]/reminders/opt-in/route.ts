import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { scheduleInviteeReminders } from "@/lib/reminders/scheduleInviteeReminders";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface PublicReminderOptInRouteContext {
  params: Promise<{ id: string }>;
}

const INVITE_SELECT =
  "id, wishlist_id, invitee_user_id, invitee_email, reminder_opted_in";

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
  context: PublicReminderOptInRouteContext
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const { data: wishlist, error: wishlistError } = await supabase
    .from("wishlists")
    .select("id, user_id, visibility, occasions(id, occasion_date)")
    .eq("id", id)
    .maybeSingle();

  const wishlistRow = wishlist as
    | {
        id: string;
        user_id: string;
        visibility: string;
      }
    | null;

  if (wishlistError) {
    return jsonError("Couldn't load wishlist.", 500);
  }

  if (!wishlistRow || wishlistRow.visibility !== "public") {
    return jsonError("Wishlist not found.", 404);
  }

  let inviteId: string | null = null;

  const { data: existingInvite } = await supabase
    .from("wishlist_invites")
    .select(INVITE_SELECT)
    .eq("wishlist_id", id)
    .eq("invitee_user_id", user.id)
    .maybeSingle();

  inviteId = (existingInvite as { id?: string } | null)?.id || null;

  if (!inviteId && user.email) {
    const { data: emailInvite } = await supabase
      .from("wishlist_invites")
      .select(INVITE_SELECT)
      .eq("wishlist_id", id)
      .eq("invitee_email", user.email.toLowerCase())
      .maybeSingle();

    inviteId = (emailInvite as { id?: string } | null)?.id || null;
  }

  if (!inviteId) {
    const { data: createdInvite, error: createError } = await supabase
      .from("wishlist_invites")
      .insert({
        wishlist_id: id,
        inviter_user_id: wishlistRow.user_id,
        invitee_user_id: user.id,
        invitee_email: user.email?.toLowerCase() || null,
        reminder_opted_in: false,
        accepted_at: new Date().toISOString(),
      })
      .select(INVITE_SELECT)
      .single();

    if (createError?.code === "23505") {
      const { data: racedInvite } = await supabase
        .from("wishlist_invites")
        .select(INVITE_SELECT)
        .eq("wishlist_id", id)
        .eq("invitee_user_id", user.id)
        .maybeSingle();
      inviteId = (racedInvite as { id?: string } | null)?.id || null;
    } else if (createError) {
      return jsonError("Couldn't create reminder opt-in.", 500);
    } else {
      inviteId = (createdInvite as { id?: string } | null)?.id || null;
    }
  }

  if (!inviteId) {
    return jsonError("Couldn't create reminder opt-in.", 500);
  }

  const { error: optInError } = await supabase.rpc(
    "gifvtme_opt_in_wishlist_invite",
    { p_invite_id: inviteId }
  );

  if (optInError) {
    return jsonError("Couldn't opt into reminders.", 500);
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
