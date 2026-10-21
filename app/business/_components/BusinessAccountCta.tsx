import { ArrowRight, Building2, CircleAlert, LayoutDashboard, LogIn } from "lucide-react";
import { Btn, Icon, cx } from "@/components/ui/primitives";
import {
  BUSINESS_DASHBOARD_HREF,
  BUSINESS_GET_STARTED_HREF,
  BUSINESS_SIGN_IN_HREF,
  type BusinessViewer,
} from "@/lib/business/entry";

const inlineLink =
  "inline-flex min-h-11 items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline";

/**
 * The way into the business dashboard from /business, chosen by who is
 * looking: `line` is the hero's quiet sub-line, `buttons` the full CTA row.
 * The Experience Centre stays the page's primary call to action. An
 * `incomplete` login goes to the sign-in screen, which explains what's wrong.
 */
export function BusinessAccountCta({
  viewer,
  variant = "buttons",
  className,
}: {
  viewer: BusinessViewer;
  variant?: "line" | "buttons";
  className?: string;
}) {
  if (variant === "line") {
    return (
      <p className={cx("text-sm text-muted", className)}>
        {viewer === "business" ? (
          <a href={BUSINESS_DASHBOARD_HREF} className={inlineLink}>
            Go to your dashboard
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        ) : viewer === "incomplete" ? (
          <>
            Your business account isn&apos;t fully set up.{" "}
            <a href={BUSINESS_SIGN_IN_HREF} className={inlineLink}>
              See how to fix it
            </a>
          </>
        ) : viewer === "consumer" ? (
          <>
            Gifting for your company?{" "}
            <a href={BUSINESS_GET_STARTED_HREF} className={inlineLink}>
              Create a business account
            </a>
          </>
        ) : (
          <>
            Already on Givftme for Business?{" "}
            <a href={BUSINESS_SIGN_IN_HREF} className={inlineLink}>
              Sign in to your dashboard
            </a>
          </>
        )}
      </p>
    );
  }

  return (
    <div className={cx("flex flex-wrap gap-3", className)}>
      {viewer === "business" ? (
        <Btn as="a" href={BUSINESS_DASHBOARD_HREF} tone="brand" className="max-sm:flex-[1_1_100%]">
          <Icon as={LayoutDashboard} />
          Open your dashboard
        </Btn>
      ) : viewer === "incomplete" ? (
        <Btn as="a" href={BUSINESS_SIGN_IN_HREF} tone="line" className="max-sm:flex-[1_1_100%]">
          <Icon as={CircleAlert} />
          Check your business account
        </Btn>
      ) : (
        <>
          <Btn as="a" href={BUSINESS_GET_STARTED_HREF} tone="brand" className="max-sm:flex-[1_1_100%]">
            <Icon as={Building2} />
            Create a business account
          </Btn>
          {viewer === "guest" ? (
            <Btn as="a" href={BUSINESS_SIGN_IN_HREF} tone="line" className="max-sm:flex-[1_1_100%]">
              <Icon as={LogIn} />
              Sign in
            </Btn>
          ) : null}
        </>
      )}
    </div>
  );
}
