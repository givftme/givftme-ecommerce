import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FeedbackProvider } from "@/hooks/useFeedback";
import { businessViewer, type BusinessViewer } from "@/lib/business/entry";
import { getBusinessSession } from "@/lib/business-dashboard/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";
import Faq from "@/app/_components/home/Faq";
import { BudgetPlanner } from "@/app/business/_components/BudgetPlanner";
import { BusinessHero } from "@/app/business/_components/BusinessHero";
import { BusinessProvider } from "@/app/business/_components/BusinessContext";
import { BUSINESS_FAQ } from "@/app/business/_components/content";
import { CorporateCalendar } from "@/app/business/_components/CorporateCalendar";
import { ExperienceCentre } from "@/app/business/_components/ExperienceCentre";
import { GiftCards } from "@/app/business/_components/GiftCards";
import { HowItWorks } from "@/app/business/_components/HowItWorks";
import { HrDashboard } from "@/app/business/_components/HrDashboard";
import { Moments } from "@/app/business/_components/Moments";
import { OccasionMarquee } from "@/app/business/_components/OccasionMarquee";
import { Plans } from "@/app/business/_components/Plans";

export const metadata: Metadata = buildPageMetadata({
  title: "For Business",
  description:
    "Branded cakes, cake packs, gift cards and hampers for team birthdays, Customer Service Week, executives and end-of-year. Talk to the Givftme Experience Centre.",
  path: "/business",
});

/** The calendar opens on the current month in Lagos, decided here so hydration matches. */
function currentLagosMonth() {
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date());
  return Number(month) - 1;
}

/** Who is looking decides the account CTAs: sign in, create, or open the dashboard. */
async function currentViewer(): Promise<BusinessViewer> {
  try {
    const { user, member, accountType } = await getBusinessSession();
    return businessViewer({ signedIn: Boolean(user), accountType, isMember: Boolean(member) });
  } catch {
    // Membership lookup unavailable: the signed-out CTAs still lead somewhere useful.
    return "guest";
  }
}

export default async function BusinessPage() {
  const viewer = await currentViewer();

  return (
    <PageWrapper>
      <FeedbackProvider>
        <BusinessProvider>
          <BusinessHero viewer={viewer} />
          <OccasionMarquee />
          <Moments />
          <Plans />
          <GiftCards />
          <BudgetPlanner />
          <CorporateCalendar currentMonth={currentLagosMonth()} />
          <HowItWorks />
          <HrDashboard viewer={viewer} />
          <ExperienceCentre />
          <Faq
            heading="Questions from HR teams"
            questions={BUSINESS_FAQ}
            headingClassName="font-display leading-[1.08]"
          />
        </BusinessProvider>
      </FeedbackProvider>
    </PageWrapper>
  );
}
