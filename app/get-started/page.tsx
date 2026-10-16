import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccountTypeOptions } from "@/components/auth/AccountTypeOptions";
import { withRedirect } from "@/lib/auth/redirect";
import { buildPageMetadata } from "@/lib/seo/metadata";

const base = buildPageMetadata({
  title: "Get Started",
  description:
    "Create your Givftme account. Build a personal wishlist for any occasion, or set up branded corporate gifting for your team.",
  path: "/get-started",
});

const SHARE_TITLE = "Join Givftme";
const SHARE_DESCRIPTION = "Personal wishlists or corporate gifting — choose the account that fits you.";

// A landing page for ads and direct shares, so it carries its own share copy.
export const metadata: Metadata = {
  ...base,
  openGraph: { ...base.openGraph, title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  twitter: { ...base.twitter, title: SHARE_TITLE, description: SHARE_DESCRIPTION },
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

// Signed-in visitors never reach this page: proxy.ts sends them home.
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ hint?: string | string[]; redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const hint = getParam(params.hint) === "business" ? "business" : null;
  const redirectTo = getParam(params.redirect);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-8">
      <Link href="/" aria-label="Givftme home" className="flex flex-col items-center gap-1">
        <Image src="/logo.png" alt="Givftme" width={150} height={44} preload />
        <span className="text-xs text-muted">The Gift Museum</span>
      </Link>

      <div className="flex w-full flex-1 flex-col items-center justify-center py-10">
        <h1 className="text-center font-display text-3xl text-ink sm:text-4xl">What brings you to Givftme?</h1>
        <p className="mt-3 max-w-md text-center text-sm leading-6 text-muted">
          Choose the account type that fits you best. You can always explore the other later.
        </p>

        <AccountTypeOptions
          className="mt-8"
          hint={hint}
          individualHref={withRedirect("/signup?type=individual", redirectTo)}
          businessHref="/business-dashboard/auth?type=business"
        />

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={withRedirect("/login", redirectTo)}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline"
          >
            Sign in
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </div>
    </main>
  );
}
