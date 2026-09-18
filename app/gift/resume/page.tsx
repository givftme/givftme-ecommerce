import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CircleAlert, Clock, Gift } from "lucide-react";
import { withRedirect } from "@/lib/auth/redirect";
import {
  GIFT_RESUME_PATH,
  PURCHASE_INTENT_COOKIE,
} from "@/lib/gift/constants";
import { isWellFormedReference } from "@/lib/gift/reference";
import { consumePurchaseIntent, resolvePurchaseIntent } from "@/lib/gift/server";
import type { ResolvedIntent } from "@/lib/gift/types";
import {
  getActivePrice,
  type SanityCheckoutProduct,
} from "@/lib/flutterwave/getActivePrice";
import { sanityFetch } from "@/lib/sanity/fetch";
import { CART_PRICES_QUERY } from "@/lib/sanity/queries";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export const dynamic = "force-dynamic";

/**
 * /gift/resume — where a visitor lands after authenticating.
 *
 * The whole point of this page is that the browser told it almost nothing.
 * It presents an opaque reference; everything else (which wishlist, which
 * item, which product, which variant, and above all what it costs) is read
 * back from the server and re-resolved from Sanity here, every time. The
 * intent record supplies identity only (spec AC-6, AC-7).
 *
 * The cookie is preferred over `?c=`. The query parameter exists for the
 * one case a cookie cannot cover: signup confirmed by clicking an email
 * link on a different device, which has never seen this browser's cookie.
 */

function resumeUrlWithReference(reference: string | null) {
  return reference
    ? `${GIFT_RESUME_PATH}?c=${encodeURIComponent(reference)}`
    : GIFT_RESUME_PATH;
}

function itemPath(intent: ResolvedIntent) {
  if (!intent.wishlist_id || !intent.wishlist_item_id) {
    return "/";
  }

  return `/w/${intent.wishlist_id}/item/${intent.wishlist_item_id}`;
}

function wishlistPath(intent: ResolvedIntent) {
  return intent.wishlist_id ? `/w/${intent.wishlist_id}` : "/";
}

function ResumeMessage({
  tone,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  tone: "neutral" | "warning";
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const Icon = tone === "warning" ? CircleAlert : Clock;

  return (
    <main className="min-h-dvh bg-surface pb-10">
      <div className="mx-auto min-h-dvh max-w-lg bg-white px-4 py-10 md:mt-10 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-8 md:shadow-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
            <Icon className="h-7 w-7 text-brand" strokeWidth={1.5} />
          </span>
          <h1 className="mt-5 text-xl font-semibold leading-7 text-ink">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">{body}</p>

          <div className="mt-7 flex w-full flex-col gap-3">
            <Link
              href={primaryHref}
              className="flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="flex h-12 w-full items-center justify-center rounded-full border border-stone-200 px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function MissingReference() {
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <div className="mx-auto min-h-dvh max-w-lg bg-white px-4 py-10 md:mt-10 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-8 md:shadow-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
            <Gift className="h-7 w-7 text-brand" strokeWidth={1.5} />
          </span>
          <h1 className="mt-5 text-xl font-semibold leading-7 text-ink">
            We lost track of that gift
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Open the wishlist link again and pick the gift you wanted. Nothing
            has been reserved and nothing has been charged.
          </p>
          <Link
            href="/"
            className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
          >
            Go to Gifvtme
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function GiftResumePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();

  const cookieReference = cookieStore.get(PURCHASE_INTENT_COOKIE)?.value ?? null;
  const queryCandidate = Array.isArray(params.c) ? params.c[0] : params.c;
  // Cookie first. The query parameter is the cross device fallback only.
  const reference = isWellFormedReference(cookieReference)
    ? cookieReference
    : isWellFormedReference(queryCandidate)
      ? queryCandidate
      : null;

  if (!reference) {
    return <MissingReference />;
  }

  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    // Reserving and buying need an account, so send them to sign in and
    // come straight back here with the reference intact.
    redirect(withRedirect("/login", resumeUrlWithReference(reference)));
  }

  const resolved = await resolvePurchaseIntent(supabase, reference);

  if (resolved.outcome === "not_found" || resolved.outcome === "cancelled") {
    return <MissingReference />;
  }

  if (resolved.outcome === "expired") {
    return (
      <ResumeMessage
        tone="neutral"
        title="Your purchase session expired"
        body="The gift is still here if you'd like to continue."
        primaryHref={itemPath(resolved)}
        primaryLabel="Back to the gift"
        secondaryHref={wishlistPath(resolved)}
        secondaryLabel="See the whole wishlist"
      />
    );
  }

  if (resolved.outcome === "account_mismatch") {
    return (
      <ResumeMessage
        tone="warning"
        title="This gift was started on another account"
        body="For safety we never move a purchase between accounts. Open the gift again to start fresh, or sign in as the account you began with."
        primaryHref={itemPath(resolved)}
        primaryLabel="Start again on this gift"
        secondaryHref={wishlistPath(resolved)}
        secondaryLabel="See the whole wishlist"
      />
    );
  }

  // A consumed intent resolves to what it already produced and creates
  // nothing, so a refreshed tab or a double submit lands on the same next
  // step rather than a second reservation (spec AC-11).
  if (resolved.outcome === "consumed") {
    redirect(
      resolved.intended_action === "buy"
        ? `/w/${resolved.wishlist_id}/gift/${resolved.wishlist_item_id}/checkout`
        : itemPath(resolved)
    );
  }

  // Re-resolve the product before creating anything. The intent carries a
  // product id and nothing else, so this is the only place the price,
  // availability and variant come from.
  if (resolved.catalog_product_id) {
    let product: SanityCheckoutProduct | null = null;

    try {
      const products = await sanityFetch<SanityCheckoutProduct[]>(
        CART_PRICES_QUERY,
        { ids: [resolved.catalog_product_id] }
      );
      product = products?.[0] ?? null;
    } catch (error) {
      console.error("Failed to re-resolve product on gift resume", error);
    }

    let unavailable = !product || product.status !== "active";

    if (!unavailable && product) {
      try {
        unavailable = getActivePrice(product, resolved.combination_key ?? null) <= 0;
      } catch {
        // Variant no longer exists on the product.
        unavailable = true;
      }
    }

    if (unavailable) {
      return (
        <ResumeMessage
          tone="neutral"
          title="This gift is no longer available"
          body="It has been taken off the store since you picked it. There are other gifts on the wishlist."
          primaryHref={wishlistPath(resolved)}
          primaryLabel="See the whole wishlist"
        />
      );
    }
  }

  const consumed = await consumePurchaseIntent(supabase, reference);

  if (consumed.outcome === "claimed") {
    redirect(
      consumed.intended_action === "buy"
        ? `/w/${consumed.wishlist_id}/gift/${consumed.wishlist_item_id}/checkout`
        : itemPath(consumed)
    );
  }

  if (consumed.outcome === "already_purchased") {
    return (
      <ResumeMessage
        tone="neutral"
        title="This one has already been bought"
        body="Somebody got there first while you were signing up. Nothing has been charged to you."
        primaryHref={wishlistPath(consumed)}
        primaryLabel="Find another gift"
      />
    );
  }

  if (consumed.outcome === "already_reserved") {
    return (
      <ResumeMessage
        tone="neutral"
        title="Someone just picked this one"
        body="It was reserved while you were signing up. Their reservation stands, and nothing has been charged to you."
        primaryHref={wishlistPath(consumed)}
        primaryLabel="Find another gift"
        secondaryHref={itemPath(consumed)}
        secondaryLabel="See this gift anyway"
      />
    );
  }

  if (consumed.outcome === "too_many_claims") {
    return (
      <ResumeMessage
        tone="warning"
        title="You're holding a few gifts already"
        body="Buy or release one of your current reservations, then come back to this one."
        primaryHref="/account/orders"
        primaryLabel="See your reservations"
        secondaryHref={itemPath(consumed)}
        secondaryLabel="Back to the gift"
      />
    );
  }

  if (consumed.outcome === "account_mismatch") {
    return (
      <ResumeMessage
        tone="warning"
        title="This gift was started on another account"
        body="For safety we never move a purchase between accounts. Open the gift again to start fresh."
        primaryHref={itemPath(consumed)}
        primaryLabel="Start again on this gift"
      />
    );
  }

  if (consumed.outcome === "expired") {
    return (
      <ResumeMessage
        tone="neutral"
        title="Your purchase session expired"
        body="The gift is still here if you'd like to continue."
        primaryHref={itemPath(consumed)}
        primaryLabel="Back to the gift"
      />
    );
  }

  return (
    <ResumeMessage
      tone="neutral"
      title="This gift is no longer available"
      body="Something changed on the wishlist while you were signing up. Nothing has been reserved and nothing has been charged."
      primaryHref={wishlistPath(consumed)}
      primaryLabel="See the whole wishlist"
    />
  );
}
