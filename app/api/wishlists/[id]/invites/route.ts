import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { sendWishlistInviteEmail } from "@/lib/email/resend";
import { buildWishlistShareUrl } from "@/lib/wishlist/shared";
import { createClient } from "@/lib/supabase/server";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
} from "@/lib/wishlist/server";
import { inviteWishlistViewerSchema } from "@/lib/wishlist/validation";

interface WishlistInvitesRouteContext {
  params: Promise<{ id: string }>;
}

const INVITE_SELECT =
  "id, wishlist_id, inviter_user_id, invitee_email, invitee_phone, invitee_user_id, token, reminder_opted_in, accepted_at, created_at";

async function requireOwner(id: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return {
      ok: false as const,
      response: jsonError("You need to sign in first.", 401),
    };
  }

  let owner: Awaited<ReturnType<typeof assertWishlistOwner>>;

  try {
    owner = await assertWishlistOwner(supabase, id, user.id);
  } catch {
    return {
      ok: false as const,
      response: jsonError("Couldn't verify wishlist access.", 500),
    };
  }

  if (!owner.ok) {
    return {
      ok: false as const,
      response: jsonError(owner.error, owner.status),
    };
  }

  return { ok: true as const, supabase, user };
}

export async function GET(_request: Request, context: WishlistInvitesRouteContext) {
  const { id } = await context.params;
  const owner = await requireOwner(id);

  if (!owner.ok) {
    return owner.response;
  }

  const { data, error } = await owner.supabase
    .from("wishlist_invites")
    .select(INVITE_SELECT)
    .eq("wishlist_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError("Couldn't load invites.", 500);
  }

  return NextResponse.json({ invites: data || [] });
}

export async function POST(request: Request, context: WishlistInvitesRouteContext) {
  const { id } = await context.params;
  const owner = await requireOwner(id);

  if (!owner.ok) {
    return owner.response;
  }

  const body = await readJson(request);
  const parsed = inviteWishlistViewerSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message || "Enter an email or phone number.",
      400
    );
  }

  const { invitee_email: email, invitee_phone: phone } = parsed.data;

  if (email && owner.user.email && email === owner.user.email.toLowerCase()) {
    return jsonError("You can't invite yourself to your own wishlist", 400);
  }

  if (phone && owner.user.phone && phone === owner.user.phone) {
    return jsonError("You can't invite yourself to your own wishlist", 400);
  }

  const duplicateQuery = owner.supabase
    .from("wishlist_invites")
    .select("id")
    .eq("wishlist_id", id)
    .limit(1);

  const { data: duplicate, error: duplicateError } = email
    ? await duplicateQuery.eq("invitee_email", email).maybeSingle()
    : await duplicateQuery.eq("invitee_phone", phone).maybeSingle();

  if (duplicateError) {
    return jsonError("Couldn't check existing invites.", 500);
  }

  if (duplicate) {
    return jsonError("You've already invited this person", 409);
  }

  const { data: invite, error } = await owner.supabase
    .from("wishlist_invites")
    .insert({
      wishlist_id: id,
      inviter_user_id: owner.user.id,
      invitee_email: email || null,
      invitee_phone: phone || null,
      reminder_opted_in: false,
    })
    .select(INVITE_SELECT)
    .single();

  if (error?.code === "23505") {
    return jsonError("You've already invited this person", 409);
  }

  if (error || !invite) {
    return jsonError("Couldn't create invite.", 500);
  }

  if (email) {
    const receiverName =
      owner.user.user_metadata?.full_name ||
      owner.user.email?.split("@")[0] ||
      "Someone";
    const token = (invite as { token?: string }).token;

    if (token) {
      await sendWishlistInviteEmail({
        to: email,
        receiverName,
        wishlistUrl: buildWishlistShareUrl(token),
      });
    }
  }

  return NextResponse.json({ invite }, { status: 201 });
}
