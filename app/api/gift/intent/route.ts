import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { withRedirect } from "@/lib/auth/redirect";
import {
  GIFT_RESUME_PATH,
  PURCHASE_INTENT_COOKIE,
  PURCHASE_INTENT_TTL_HOURS,
} from "@/lib/gift/constants";
import { createPurchaseReference } from "@/lib/gift/reference";
import { createPurchaseIntent, getActiveClaim } from "@/lib/gift/server";
import { purchaseIntentSchema } from "@/lib/gift/validation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

/**
 * POST /api/gift/intent — the one thing a signed out visitor may do.
 *
 * It records what they were trying to do on the server, hands the browser
 * an opaque reference that means nothing on its own, and returns where to
 * send them to authenticate. It creates no claim and blocks no item, so a
 * visitor who never finishes signing up costs another giver nothing (spec
 * AC-12).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await readJson(request);
  const parsed = purchaseIntentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("We couldn't work out which gift you picked.", 400);
  }

  const { wishlist_item_id: itemId, intended_action: action } = parsed.data;
  const user = await getAuthenticatedApiUser(supabase);

  if (user) {
    // Already signed in, so there is nothing to carry across signup and no
    // reason to write a row. Spec AC-3 asserts no intent exists in this
    // case, so this path deliberately creates nothing.
    const claim = await getActiveClaim(supabase, itemId);

    return NextResponse.json({
      authenticated: true,
      auth_url: null,
      next_url:
        claim && action === "buy"
          ? `/w/${claim.wishlist_id}/gift/${itemId}/checkout`
          : null,
    });
  }

  const reference = createPurchaseReference();
  const created = await createPurchaseIntent(supabase, {
    reference,
    itemId,
    combinationKey: parsed.data.combination_key,
    selectedOptions: parsed.data.selected_options,
    intendedAction: action,
  });

  if (!created.ok) {
    return jsonError(created.error, created.status);
  }

  // The reference rides in the redirect target as well as the cookie. That
  // is what makes signup completing on a different device work: a phone
  // opening the confirmation email has never seen this cookie. Resume
  // prefers the cookie and falls back to `?c=` (spec AC-8).
  const resumeTarget = `${GIFT_RESUME_PATH}?c=${encodeURIComponent(reference)}`;
  const response = NextResponse.json({
    authenticated: false,
    auth_url: withRedirect("/signup", resumeTarget),
    login_url: withRedirect("/login", resumeTarget),
    // Handed back so the existing AuthGateSheet can build its own sign up
    // and sign in links from the same target.
    resume_path: resumeTarget,
    expires_at: created.intent.expires_at,
  });

  response.cookies.set(PURCHASE_INTENT_COOKIE, reference, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PURCHASE_INTENT_TTL_HOURS * 60 * 60,
  });

  return response;
}
